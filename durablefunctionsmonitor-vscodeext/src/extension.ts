const portscanner = require('portscanner');

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as killProcessTree from 'tree-kill';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';

import { promisify } from "util";
const writeFileAsync = promisify(fs.writeFile);

import * as SharedConstants from './SharedConstants';

import * as settings from './settings.json';

// Reference to the shell instance running func.exe
var funcProcess: ChildProcess | null;

// Some info about the running backend
class BackendProperties {
    url: string = '';
    accountName: string = '';
    hubName: string = '';
}

// Promise that resolves when the backend is started successfully
var backendPromise: Promise<BackendProperties> | null;

// Storing the collected connection settings in a global variable, don't want to ask the user repeatedly
type StorageConnectionSettings = { storageConnString: string, hubName: string };
var storageConnectionSettings: StorageConnectionSettings | null;

// A nonce for communicating with the backend
const BackendCommunicationNonce = crypto.randomBytes(64).toString('base64');

// Reference to the already opened WebView with the main page
var mainWebViewPanel: vscode.WebviewPanel | null;


export function activate(context: vscode.ExtensionContext) {

    context.subscriptions.push(

        vscode.commands.registerCommand('extension.durableFunctionsMonitor',
            () => showDurableFunctionsMonitor(context)),
        
        vscode.commands.registerCommand('extension.durableFunctionsMonitorPurgeHistory',
            () => showDurableFunctionsMonitor(context, { id: 'purgeHistory' }))
    );
}

function showDurableFunctionsMonitor(context: vscode.ExtensionContext, messageToWebView: any = undefined) {

    if (!!mainWebViewPanel) {
        // Didn't find a way to check whether the panel still exists. 
        // So just have to catch a "panel disposed" exception here.
        try {
            
            mainWebViewPanel.reveal();
            if (!!messageToWebView) {
                mainWebViewPanel.webview.postMessage(messageToWebView);
            }

            return;
        } catch (err) {    
            mainWebViewPanel = null;
        }
    }

    const dfmBinariesFolder = path.join(context.extensionPath, 'backend');
    const wwwRootFolder = path.join(dfmBinariesFolder, 'wwwroot');

    getStorageConnectionSettings().then(connSettings => {

        // Starting the backend 
        startBackend(dfmBinariesFolder, connSettings)
            .then(backendUrl => {

                try {
                    mainWebViewPanel = showMainPage(wwwRootFolder, backendUrl, context, '', messageToWebView);
                } catch (err) {
                    vscode.window.showErrorMessage(`WebView failed: ${err}`);
                }

            }, err => {
                vscode.window.showErrorMessage(`Backend failed: ${err}`);
            });
    }, err => {
        vscode.window.showErrorMessage(`Couldn't get Storage Connnection Settings: ${err}`);
    });
}

// Obtains Storage Connection String and Hub Name from the user
function getStorageConnectionSettings(): Promise<StorageConnectionSettings> {

    // As of today, asking just once
    if (!!storageConnectionSettings) {
        return new Promise<StorageConnectionSettings>(resolve => resolve(storageConnectionSettings!));
    }

    return new Promise<StorageConnectionSettings>((resolve, reject) => {

        const ws = vscode.workspace;

        // Asking the user for Connection String
        var userPrompt = 'Storage Connection String';
        var connStringFromLocalSettings = '';
        var connStringToShow = '';

        if (!!ws.rootPath && fs.existsSync(path.join(ws.rootPath, 'local.settings.json'))) {

            const localSettings = JSON.parse(fs.readFileSync(path.join(ws.rootPath, 'local.settings.json'), 'utf8'));

            if (!!localSettings.Values && !!localSettings.Values.AzureWebJobsStorage) {
                connStringFromLocalSettings = localSettings.Values.AzureWebJobsStorage;
            }

            if (!!connStringFromLocalSettings) {
                connStringToShow = connStringFromLocalSettings.replace(/AccountKey=[^;]+/gi, 'AccountKey=*****');
                userPrompt += ' (from local.settings.json)';
            }
        }

        vscode.window.showInputBox({ value: connStringToShow, prompt: userPrompt }).then(connString => {

            if (!connString) { 
                // Leaving the promise unresolved, so nothing more happens
                return;
            }

            // If the user didn't change it
            if (connString === connStringToShow) {
                // Then setting it back to non-masked one
                connString = connStringFromLocalSettings;
            }

            // Asking the user for Hub Name
            userPrompt = 'Hub Name';
            var hubNameToShow = 'DurableFunctionsHub';

            if (!!ws.rootPath && fs.existsSync(path.join(ws.rootPath, 'host.json'))) {

                const hostJson = JSON.parse(fs.readFileSync(path.join(ws.rootPath, 'host.json'), 'utf8'));
                if (!!hostJson && !!hostJson.extensions && hostJson.extensions.durableTask && !!hostJson.extensions.durableTask.HubName) {
                    hubNameToShow = hostJson.extensions.durableTask.HubName;
                    userPrompt += ' (from host.json)';
                }
            }

            vscode.window.showInputBox({ value: hubNameToShow, prompt: userPrompt }).then(hubName => {

                if (!hubName) {
                    // Leaving the promise unresolved, so nothing more happens
                    return;
                }

                storageConnectionSettings = { storageConnString: connString!, hubName };
                resolve(storageConnectionSettings);

            }, reject);
        }, reject);
    });
}

// Picks up a port and runs the backend Function instance on it
function startBackend(dfmBinariesFolder: string, connSettings: StorageConnectionSettings): Promise<BackendProperties> {

    // Only starting one backend instance per VsCode instance
    if (!!backendPromise) {
        return backendPromise;
    }

    backendPromise = new Promise<BackendProperties>((resolve, reject) => { 
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Starting the backend `,
            cancellable: true
        }, (progress, token) => new Promise(stopProgress => {

            // Starting the backend on a first available port
            portscanner.findAPortNotInUse(37072, 38000).then((portNr: number) => {

                // Writing Hub Name into host.json.
                // Yes, so far it means that you can only monitor one Hub at a time 
                // (even if you run multiple VsCode instances, their backends will pick up latest changes 
                // to this file :( )). Didn't find any other way to specify Hub Name yet.
                const host = {
                    version: "2.0",
                    extensions: {
                        durableTask: {
                            HubName: connSettings.hubName
                        }
                    }
                };
                writeFileAsync(path.join(dfmBinariesFolder, 'host.json'), JSON.stringify(host, null, 4)).then(() => {

                    const backendUrl = settings.backendBaseUrl.replace('{portNr}', portNr.toString());
                    progress.report({ message: backendUrl });

                    // Now running func.exe in backend folder
                    startBackendOnPort(dfmBinariesFolder, portNr, backendUrl, connSettings.storageConnString, token)
                        .then(resolve, reject)
                        .finally(stopProgress);

                }, err => { stopProgress(); reject(err); });
                
            }, (err: any) => { stopProgress(); reject(err); });
        }));        
    });

    // Allowing the user to try again
    backendPromise.catch(() => {
        cleanupFuncProcess();
    });

    return backendPromise;
}

// Runs the backend Function instance on some port
function startBackendOnPort(dfmBinariesFolder: string,
    portNr: number,
    backendUrl: string,
    storageConnString: string,
    cancelToken: vscode.CancellationToken): Promise<BackendProperties> {

    console.log(`Attempting to start the backend on ${backendUrl}...`);

    const env: any = { 'AzureWebJobsStorage': storageConnString };
    env[SharedConstants.NonceEnvironmentVariableName] = BackendCommunicationNonce;

    funcProcess = spawn('func', ['start', '--port', portNr.toString()], {
        cwd: dfmBinariesFolder,
        shell: true,
        env
    });

    funcProcess.stdout.on('data', function (data) {
        console.log('Func.exe: ' + data.toString());
    });

    return new Promise<BackendProperties>((resolve, reject) => {

        funcProcess!.on('error', (data) => {
            reject(`Couldn't start func.exe: ${data.toString()}`);
        });

        console.log(`Waiting for ${backendUrl} to respond...`);

        // Waiting for 30 sec. for the backend to be ready
        const timeoutInSeconds = settings.backendTimeoutInSeconds;
        const intervalInMs = 500, numOfTries = timeoutInSeconds * 1000 / intervalInMs;
        var i = numOfTries;
        const intervalToken = setInterval(() => {

            const headers: any = {};
            headers[SharedConstants.NonceHeaderName] = BackendCommunicationNonce;

            // Pinging the backend and returning its URL when ready
            axios.get(backendUrl + '/about', {headers}).then(response => {
                console.log(`The backend is now running on ${backendUrl}`);
                clearInterval(intervalToken);
                resolve({
                    url: backendUrl,
                    accountName: response.data.accountName,
                    hubName: response.data.hubName
                });
            });

            if (cancelToken.isCancellationRequested) {

                clearInterval(intervalToken);
                reject(`Cancelled by the user`);

            } else if (--i <= 0) {
                console.log(`Timed out waiting for the backend!`);
                clearInterval(intervalToken);
                reject(`No response within ${timeoutInSeconds} seconds. Ensure you have the latest Azure Functions Core Tools installed globally.`);
            }

        }, intervalInMs);
    });
}

// Opens a WebView with main page or orchestration page in it
function showMainPage(pathToWwwRoot: string, backendProps: BackendProperties,
    context: vscode.ExtensionContext, orchestrationId: string = '', messageToWebView: any = undefined) : vscode.WebviewPanel {
    
    const title = (!!orchestrationId) ?
        `Instance '${orchestrationId}'`
        :
        `Durable Functions Monitor (${backendProps.accountName}/${backendProps.hubName})`;
    
    const panel = vscode.window.createWebviewPanel(
        'durableFunctionsMonitor',
        title,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(pathToWwwRoot)]
        }
    );

    var html = fs.readFileSync(path.join(pathToWwwRoot, 'index.html'), 'utf8');
    html = fixLinksToStatics(html, pathToWwwRoot, panel.webview);

    if (!!orchestrationId) {
        html = embedOrchestrationId(html, orchestrationId);
    }

    panel.webview.html = html;

    // handle events from WebView
    panel.webview.onDidReceiveMessage(request => {

        // Sending an initial message (if any), when the webView is ready
        if (request.method === 'IAmReady') {
            if (!!messageToWebView) {
                panel.webview.postMessage(messageToWebView);
                messageToWebView = undefined;
            }
            return;
        }

        if (request.method === 'OpenInNewWindow') {
            // Opening another WebView
            showMainPage(pathToWwwRoot, backendProps, context, request.url);
            return;
        }

        // Then it's just a propagated HTTP request
        const requestId = request.id;

        const headers: any = {};
        headers[SharedConstants.NonceHeaderName] = BackendCommunicationNonce;

        axios.request({
            url: backendProps.url + request.url,
            method: request.method,
            data: request.data,
            headers
        }).then(response => { 

            panel.webview.postMessage({ id: requestId, data: response.data });
        }, err => { 
                
            panel.webview.postMessage({ id: requestId, err });
        });

    }, undefined, context.subscriptions);

    return panel;
}

// Embeds the orchestrationId in the HTML served
function embedOrchestrationId(html: string, orchestrationId: string): string {
    return html.replace(`<script>var OrchestrationIdFromVsCode=""</script>`, `<script>var OrchestrationIdFromVsCode="${orchestrationId}"</script>`);
}

// Converts script and CSS links
function fixLinksToStatics(originalHtml: string, pathToBackend: string, webView: vscode.Webview): string {

    var resultHtml: string = originalHtml;

    const regex = / (href|src)="\/api\/monitor\/([0-9a-z.\/]+)"/ig;
    var match: RegExpExecArray | null;
    while (match = regex.exec(originalHtml)) {

        const relativePath = match[2];
        const localPath = path.join(pathToBackend, relativePath);
        const newPath = webView.asWebviewUri(vscode.Uri.file(localPath)).toString();

        resultHtml = resultHtml.replace(`/api/monitor/${relativePath}`, newPath);
    }

    return resultHtml;
}

// Kills the pending backend proces
function cleanupFuncProcess(): Promise<any> | undefined {

    storageConnectionSettings = null;
    backendPromise = null;

    if (!funcProcess) {
        return;
    }

    console.log('Killing func.exe...');

    return new Promise((resolve) => {

        // The process is a shell. So to stop func.exe, we need to kill the entire process tree.
        killProcessTree(funcProcess!.pid, resolve);
        funcProcess = null;
    });
}

export function deactivate() {
    return cleanupFuncProcess();
}

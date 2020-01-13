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

type StorageConnectionSettings = { storageConnString: string, hubName: string };

// Some info about the running backend
class BackendProperties {
    url: string = '';
    accountName: string = '';
    hubName: string = '';
}

// Represents the main view, along with all detailed views and the running backend process
export class DurableFunctionsMonitor
{
    constructor(private _context: vscode.ExtensionContext) {

        this._binariesFolder = path.join(this._context.extensionPath, 'backend');
        this._wwwRootFolder = path.join(this._binariesFolder, 'wwwroot');
    }

    // Shows or makes active the main view
    show(messageToWebView: any = undefined) {

        if (!!this._webViewPanel) {
            // Didn't find a way to check whether the panel still exists. 
            // So just have to catch a "panel disposed" exception here.
            try {

                this._webViewPanel.reveal();
                if (!!messageToWebView) {
                    this._webViewPanel.webview.postMessage(messageToWebView);
                }

                return;
            } catch (err) {
                this._webViewPanel = null;
            }
        }

        this.getStorageConnectionSettings().then(connSettings => {

            // Starting the backend 
            this.startBackend(connSettings)
                .then(backendProps => {

                    try {
                        this._webViewPanel = this.showMainPage(backendProps, '', messageToWebView);
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

    // Kills the pending backend proces
    cleanup(): Promise<any> | undefined {

        this._storageConnectionSettings = null;
        this._backendPromise = null;

        if (!this._funcProcess) {
            return;
        }

        console.log('Killing func.exe...');

        return new Promise((resolve) => {

            // The process is a shell. So to stop func.exe, we need to kill the entire process tree.
            killProcessTree(this._funcProcess!.pid, resolve);
            this._funcProcess = null;
        });
    }

    // Path to backend binaries folder
    private _binariesFolder: string;

    // Path to html statics
    private _wwwRootFolder: string;

    // Reference to the shell instance running func.exe
    private _funcProcess: ChildProcess | null = null;

    // Promise that resolves when the backend is started successfully
    private _backendPromise: Promise<BackendProperties> | null = null;

    // A nonce for communicating with the backend
    private _backendCommunicationNonce = crypto.randomBytes(64).toString('base64');

    // Reference to the already opened WebView with the main page
    private _webViewPanel: vscode.WebviewPanel | null = null;    

    // Storing the collected connection settings once collected, don't want to ask the user repeatedly
    private _storageConnectionSettings: StorageConnectionSettings | null = null;
    
    // Obtains Storage Connection String and Hub Name from the user
    private getStorageConnectionSettings(): Promise<StorageConnectionSettings> {

        // As of today, asking just once
        if (!!this._storageConnectionSettings) {
            return new Promise<StorageConnectionSettings>(resolve => resolve(this._storageConnectionSettings!));
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

                    this._storageConnectionSettings = { storageConnString: connString!, hubName };
                    resolve(this._storageConnectionSettings);

                }, reject);
            }, reject);
        });
    }
    
    // Picks up a port and runs the backend Function instance on it
    private startBackend(connSettings: StorageConnectionSettings): Promise<BackendProperties> {

        // Only starting one backend instance per VsCode instance
        if (!!this._backendPromise) {
            return this._backendPromise;
        }

        this._backendPromise = new Promise<BackendProperties>((resolve, reject) => {

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
                    writeFileAsync(path.join(this._binariesFolder, 'host.json'), JSON.stringify(host, null, 4)).then(() => {

                        const backendUrl = settings.backendBaseUrl.replace('{portNr}', portNr.toString());
                        progress.report({ message: backendUrl });

                        // Now running func.exe in backend folder
                        this.startBackendOnPort(this._binariesFolder, portNr, backendUrl, connSettings.storageConnString, token)
                            .then(resolve, reject)
                            .finally(stopProgress);

                    }, err => { stopProgress(); reject(err); });

                }, (err: any) => { stopProgress(); reject(err); });
            }));
        });

        // Allowing the user to try again
        this._backendPromise.catch(() => {
            this.cleanup();
        });

        return this._backendPromise;
    }

    // Runs the backend Function instance on some port
    private startBackendOnPort(dfmBinariesFolder: string,
        portNr: number,
        backendUrl: string,
        storageConnString: string,
        cancelToken: vscode.CancellationToken): Promise<BackendProperties> {

        console.log(`Attempting to start the backend on ${backendUrl}...`);

        const env: any = { 'AzureWebJobsStorage': storageConnString };
        env[SharedConstants.NonceEnvironmentVariableName] = this._backendCommunicationNonce;

        this._funcProcess = spawn('func', ['start', '--port', portNr.toString()], {
            cwd: dfmBinariesFolder,
            shell: true,
            env
        });

        this._funcProcess.stdout.on('data', function (data) {
            console.log('Func.exe: ' + data.toString());
        });

        return new Promise<BackendProperties>((resolve, reject) => {

            this._funcProcess!.on('error', (data) => {
                reject(`Couldn't start func.exe: ${data.toString()}`);
            });

            console.log(`Waiting for ${backendUrl} to respond...`);

            // Waiting for 30 sec. for the backend to be ready
            const timeoutInSeconds = settings.backendTimeoutInSeconds;
            const intervalInMs = 500, numOfTries = timeoutInSeconds * 1000 / intervalInMs;
            var i = numOfTries;
            const intervalToken = setInterval(() => {

                const headers: any = {};
                headers[SharedConstants.NonceHeaderName] = this._backendCommunicationNonce;

                // Pinging the backend and returning its URL when ready
                axios.get(backendUrl + '/about', { headers }).then(response => {
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
    private showMainPage(backendProps: BackendProperties,
        orchestrationId: string = '',
        messageToWebView: any = undefined): vscode.WebviewPanel {

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
                localResourceRoots: [vscode.Uri.file(this._wwwRootFolder)]
            }
        );

        var html = fs.readFileSync(path.join(this._wwwRootFolder, 'index.html'), 'utf8');
        html = DurableFunctionsMonitor.fixLinksToStatics(html, this._wwwRootFolder, panel.webview);

        if (!!orchestrationId) {
            html = DurableFunctionsMonitor.embedOrchestrationId(html, orchestrationId);
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
                this.showMainPage(backendProps, request.url);
                return;
            }

            // Then it's just a propagated HTTP request
            const requestId = request.id;

            const headers: any = {};
            headers[SharedConstants.NonceHeaderName] = this._backendCommunicationNonce;

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

        }, undefined, this._context.subscriptions);

        return panel;
    }

    // Embeds the orchestrationId in the HTML served
    private static embedOrchestrationId(html: string, orchestrationId: string): string {
        return html.replace(`<script>var OrchestrationIdFromVsCode=""</script>`, `<script>var OrchestrationIdFromVsCode="${orchestrationId}"</script>`);
    }

    // Converts script and CSS links
    private static fixLinksToStatics(originalHtml: string, pathToBackend: string, webView: vscode.Webview): string {

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
}
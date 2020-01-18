const portscanner = require('portscanner');

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as killProcessTree from 'tree-kill';
import axios from 'axios';
import { spawn, ChildProcess } from 'child_process';

import * as SharedConstants from './SharedConstants';
import * as settings from './settings.json';

class StorageConnectionSettings {
    storageConnString: string = '';
    hubName: string = '';
}

// Some info about the running backend
export class BackendProperties {
    url: string = '';
    accountName: string = '';
    hubName: string = '';
}

// Responsible for running the backend process
export class BackendProcess {

    constructor(private _binariesFolder: string) {
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

    protected get backendCommunicationNonce(): string { return this._backendCommunicationNonce; }

    // Ensures that the backend is running and returns its properties
    protected getBackend(): Promise<BackendProperties> {
        return new Promise<BackendProperties>((resolve, reject) => {

            // Asking user for connection params
            this.getStorageConnectionSettings().then(connSettings => {

                // Starting the backend 
                this.startBackend(connSettings).then(resolve, err => reject(`Backend failed: ${err}`));

            }, err => reject(`Couldn't get Storage Connnection Settings: ${err}`));

        });
    }

    // Reference to the shell instance running func.exe
    private _funcProcess: ChildProcess | null = null;

    // Promise that resolves when the backend is started successfully
    private _backendPromise: Promise<BackendProperties> | null = null;

    // A nonce for communicating with the backend
    private _backendCommunicationNonce = crypto.randomBytes(64).toString('base64');

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
                    if (!!hostJson && !!hostJson.extensions && hostJson.extensions.durableTask) {

                        const durableTask = hostJson.extensions.durableTask;
                        if (!!durableTask.HubName || !!durableTask.hubName) {
                            hubNameToShow = !!durableTask.HubName ? durableTask.HubName : durableTask.hubName;
                            userPrompt += ' (from host.json)';
                        }
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

                    const backendUrl = settings.backendBaseUrl.replace('{portNr}', portNr.toString());
                    progress.report({ message: backendUrl });

                    // Now running func.exe in backend folder
                    this.startBackendOnPort(portNr, backendUrl, connSettings, token)
                        .then(resolve, reject)
                        .finally(stopProgress);
                    
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
    private startBackendOnPort(portNr: number,
        backendUrl: string,
        connSettings: StorageConnectionSettings,
        cancelToken: vscode.CancellationToken): Promise<BackendProperties> {

        console.log(`Attempting to start the backend on ${backendUrl}...`);

        const env: any = {
            'AzureWebJobsStorage': connSettings.storageConnString,
            'DFM_HUB_NAME': connSettings.hubName
        };

        env[SharedConstants.NonceEnvironmentVariableName] = this._backendCommunicationNonce;

        this._funcProcess = spawn('func', ['start', '--port', portNr.toString(), '--csharp'], {
            cwd: this._binariesFolder,
            shell: true,
            env
        });

        this._funcProcess.stdout.on('data', function (data) {
            console.log('Func.exe: ' + data.toString());
        });

        if (!!settings.logging) {
            // logging backend's output to a text file
            const logStream = fs.createWriteStream(path.join(this._binariesFolder, `backend-${portNr}.log`), { flags: 'w' });
            this._funcProcess.stdout.pipe(logStream);
            this._funcProcess.stderr.pipe(logStream);
        }

        return new Promise<BackendProperties>((resolve, reject) => {

            this._funcProcess!.stderr.on('data', function (data) {
                reject(data.toString());
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
}
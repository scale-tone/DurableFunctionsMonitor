import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { MonitorView } from "./MonitorView";
import { StorageConnectionSettings } from './BackendProcess';

// Represents all MonitorViews created so far
export class MonitorViewList {

    constructor(private _context: vscode.ExtensionContext) {
    }

    // Creates a new MonitorView with provided connection settings
    createFromStorageConnectionSettings(storageConnectionSettings: StorageConnectionSettings): MonitorView {
        const newView = new MonitorView(this._context, storageConnectionSettings);
        this._monitorViews.push(newView);
        return newView;
    }

    // Gets an existing (first in the list) MonitorView,
    // or initializes a new one by asking user for connection settings
    getOrAdd(alwaysCreateNew: boolean): Promise<MonitorView> {

        if (!alwaysCreateNew && this._monitorViews.length > 0) {
            return Promise.resolve(this._monitorViews[0]);
        }

        return new Promise<MonitorView>((resolve, reject) => {
            this.askForStorageConnectionSettings().then(connSettings => {

                // If a backend for this connection already exists, then just returning the existing one
                var monitorView = this._monitorViews.find(v => StorageConnectionSettings.areEqual(v.storageConnectionSettings!, connSettings));
                if (!monitorView) {
                    monitorView = new MonitorView(this._context, connSettings);
                    this._monitorViews.push(monitorView);
                }

                resolve(monitorView);
            }, reject);
        });
    }

    // Removes the specified MonitorView from the list
    remove(view: MonitorView) {

        const i = this._monitorViews.indexOf(view);
        if (i >= 0) {
            this._monitorViews.splice(i, 1);
        }
    }

    // Stops all backend processes and closes all views
    cleanup(): Promise<any> | undefined {
        const views = this._monitorViews;
        this._monitorViews = [];
        return Promise.all(views.map(v => v.cleanup()));
    }

    private _monitorViews: MonitorView[] = [];

    // Obtains Storage Connection String and Hub Name from user
    private askForStorageConnectionSettings(): Promise<StorageConnectionSettings> {

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
                    connStringToShow = StorageConnectionSettings.maskStorageConnString(connStringFromLocalSettings);
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

                    resolve({ storageConnString: connString!, hubName });

                }, reject);
            }, reject);
        });
    }
}
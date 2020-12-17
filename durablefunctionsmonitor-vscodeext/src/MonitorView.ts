import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

import * as SharedConstants from './SharedConstants';

import { BackendProcess, StorageConnectionSettings } from './BackendProcess';

// Represents the main view, along with all detailed views
export class MonitorView extends BackendProcess
{
    constructor(private _context: vscode.ExtensionContext,
        storageConnectionSettings: StorageConnectionSettings,
        log: (l: string) => void) {
        
        super(path.join(_context.extensionPath, 'backend'), storageConnectionSettings, log);
        this._wwwRootFolder = path.join(this._context.extensionPath, 'backend', 'wwwroot');
    }

    // Closes all WebViews and stops the backend process
    cleanup(): Promise<any> | undefined {

        for (var childPanel of this._childWebViewPanels) {
            childPanel.dispose();
        }
        this._childWebViewPanels = [];

        if (!!this._webViewPanel) {
            this._webViewPanel.dispose();
        }

        return super.cleanup();
    }

    // Shows or makes active the main view
    show(messageToWebView: any = undefined): Promise<void> {

        if (!!this._webViewPanel) {
            // Didn't find a way to check whether the panel still exists. 
            // So just have to catch a "panel disposed" exception here.
            try {

                this._webViewPanel.reveal();
                if (!!messageToWebView) {
                    // BUG: WebView might actually appear in 3 states: disposed, visible and inactive.
                    // Didn't find the way to distinguish the last two. 
                    // But when it is inactive, it will be activated with above reveal() method,
                    // and then miss this message we're sending here. No good solution for this problem so far...
                    this._webViewPanel.webview.postMessage(messageToWebView);
                }

                return Promise.resolve();
            } catch (err) {
                this._webViewPanel = null;
            }
        }

        return new Promise<void>((resolve, reject) => {

            this.getBackend().then(() => {

                try {
                    this._webViewPanel = this.showMainPage('', messageToWebView);

                    resolve();
                } catch (err) {
                    reject(`WebView failed: ${err}`);
                }
                
            }, reject);
        });
    }

    // Permanently deletes all underlying Storage resources for this Task Hub
    deleteTaskHub(): Promise<any> {

        const headers: any = {};
        headers[SharedConstants.NonceHeaderName] = this.backendCommunicationNonce;

        return axios.post(this.backendProperties!.backendUrl + '/delete-task-hub', {}, { headers });
    }

    // Handles 'Goto instanceId...' context menu item
    gotoInstanceId() {

        this.askForInstanceId().then(instanceId => {

            // Opening another WebView
            this._childWebViewPanels.push(this.showMainPage(instanceId));
        });
    }

    // Path to html statics
    private _wwwRootFolder: string;

    // Reference to the already opened WebView with the main page
    private _webViewPanel: vscode.WebviewPanel | null = null;    

    // Reference to all child WebViews
    private _childWebViewPanels: vscode.WebviewPanel[] = [];    

    private static readonly ViewType = 'durableFunctionsMonitor';
    private static readonly GlobalStateName = MonitorView.ViewType + 'WebViewState';

    // Opens a WebView with main page or orchestration page in it
    private showMainPage(orchestrationId: string = '',
        messageToWebView: any = undefined): vscode.WebviewPanel {

        const title = (!!orchestrationId) ?
            `Instance '${orchestrationId}'`
            :
            `Durable Functions Monitor (${this.taskHubFullTitle})`;

        const panel = vscode.window.createWebviewPanel(
            MonitorView.ViewType,
            title,
            vscode.ViewColumn.One,
            {
                retainContextWhenHidden: true,
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(this._wwwRootFolder)]
            }
        );

        var html = fs.readFileSync(path.join(this._wwwRootFolder, 'index.html'), 'utf8');
        html = MonitorView.fixLinksToStatics(html, this._wwwRootFolder, panel.webview);

        // Also passing persisted settings via HTML
        const webViewState = this._context.globalState.get(MonitorView.GlobalStateName, {});

        html = MonitorView.embedOrchestrationIdAndState(html, orchestrationId, webViewState);

        panel.webview.html = html;

        // handle events from WebView
        panel.webview.onDidReceiveMessage(request => {

            switch (request.method) {
                case 'IAmReady':
                    // Sending an initial message (if any), when the webView is ready
                    if (!!messageToWebView) {
                        panel.webview.postMessage(messageToWebView);
                        messageToWebView = undefined;
                    }
                    return;
                case 'PersistState':
                    // Persisting state values
                    const webViewState = this._context.globalState.get(MonitorView.GlobalStateName, {}) as any;
                    webViewState[request.key] = request.data;
                    this._context.globalState.update(MonitorView.GlobalStateName, webViewState);
                    return;
                case 'OpenInNewWindow':
                    // Opening another WebView
                    this._childWebViewPanels.push(this.showMainPage(request.url));
                    return;
                case 'SaveAs':

                    // Just to be extra sure...
                    if (!this.looksLikeSvg(request.data)) {
                        vscode.window.showErrorMessage(`Invalid data format. Save failed.`);
                        return;
                    }
                    
                    // Saving some file to local hard drive
                    vscode.window.showSaveDialog({ filters: { 'SVG Images': ['svg'] } }).then(filePath => {

                        if (!filePath || !filePath.fsPath) { 
                            return;
                        }

                        fs.writeFile(filePath!.fsPath, request.data, err => {
                            if (!err) {
                                vscode.window.showInformationMessage(`Saved to ${filePath!.fsPath}`);
                            } else {
                                vscode.window.showErrorMessage(`Failed to save. ${err}`);
                            }
                        });
                    });
                    return;
            }

            // Then it's just a propagated HTTP request
            const requestId = request.id;

            const headers: any = {};
            headers[SharedConstants.NonceHeaderName] = this.backendCommunicationNonce;

            axios.request({
                url: this.backendProperties!.backendUrl + request.url,
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
    private static embedOrchestrationIdAndState(html: string, orchestrationId: string, state: any): string {
        return html.replace(
            `<script>var OrchestrationIdFromVsCode="",StateFromVsCode={}</script>`,
            `<script>var OrchestrationIdFromVsCode="${orchestrationId}",StateFromVsCode=${JSON.stringify(state)}</script>`
        );
    }

    // Converts script and CSS links
    private static fixLinksToStatics(originalHtml: string, pathToBackend: string, webView: vscode.Webview): string {

        var resultHtml: string = originalHtml;

        const regex = / (href|src)="\/([0-9a-z.\/]+)"/ig;
        var match: RegExpExecArray | null;
        while (match = regex.exec(originalHtml)) {

            const relativePath = match[2];
            const localPath = path.join(pathToBackend, relativePath);
            const newPath = webView.asWebviewUri(vscode.Uri.file(localPath)).toString();

            resultHtml = resultHtml.replace(`/${relativePath}`, newPath);
        }

        return resultHtml;
    }

    // Validates incoming SVG, just to be extra sure...
    private looksLikeSvg(data: string): boolean {
        return data.startsWith('<svg') && data.endsWith('</svg>') && !data.includes('<script');
    }

    private askForInstanceId(): Promise<string> {
        return new Promise<string>((resolve, reject) => {

            var instanceId = '';
            const instanceIdPick = vscode.window.createQuickPick();

            instanceIdPick.onDidHide(() => instanceIdPick.dispose());

            instanceIdPick.onDidChangeSelection(items => {
                if (!!items && !!items.length) {
                    instanceId = items[0].label;
                }
            });

            // Still allowing to type free text
            instanceIdPick.onDidChangeValue(value => {
                instanceId = value;

                // Loading suggestions from backend
                if (instanceId.length > 1) {
                    this.getInstanceIdSuggestions(instanceId).then(suggestions => {

                        instanceIdPick.items = suggestions.map(id => {
                            return { label: id };
                        });
                    });
                } else {
                    instanceIdPick.items = [];
                }
            });

            instanceIdPick.onDidAccept(() => {
                if (!!instanceId) {
                    resolve(instanceId);
                }
                instanceIdPick.hide();
            });

            instanceIdPick.title = `(${this.taskHubFullTitle}) instanceId to go to:`;

            instanceIdPick.show();
            // If nothing is selected, leaving the promise unresolved, so nothing more happens
        });
    }

    // Returns orchestration/entity instanceIds that start with prefix
    private getInstanceIdSuggestions(prefix: string): Promise<string[]> {

        const headers: any = {};
        headers[SharedConstants.NonceHeaderName] = this.backendCommunicationNonce;

        return axios.get(`${this.backendProperties!.backendUrl}/id-suggestions(prefix='${prefix}')`, { headers })
            .then(response => {
                return response.data as string[];
            });
    }
}
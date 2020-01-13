import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

import * as SharedConstants from './SharedConstants';

import { BackendProperties, BackendProcess } from './BackendProcess';

// Represents the main view, along with all detailed views
export class MonitorView extends BackendProcess
{
    constructor(private _context: vscode.ExtensionContext) {
        super(path.join(_context.extensionPath, 'backend'));
        this._wwwRootFolder = path.join(this._context.extensionPath, 'backend', 'wwwroot');
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

        this.getBackend().then(backendProps => {

            try {
                this._webViewPanel = this.showMainPage(backendProps, '', messageToWebView);
            } catch (err) {
                vscode.window.showErrorMessage(`WebView failed: ${err}`);
            }

        }, vscode.window.showErrorMessage);
    }

    // Path to html statics
    private _wwwRootFolder: string;

    // Reference to the already opened WebView with the main page
    private _webViewPanel: vscode.WebviewPanel | null = null;    

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
        html = MonitorView.fixLinksToStatics(html, this._wwwRootFolder, panel.webview);

        if (!!orchestrationId) {
            html = MonitorView.embedOrchestrationId(html, orchestrationId);
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
            headers[SharedConstants.NonceHeaderName] = this.backendCommunicationNonce;

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
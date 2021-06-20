import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { MonitorView } from './MonitorView';
import { FunctionGraphList } from './FunctionGraphList';

// Represents the function graph view
export class FunctionGraphView
{
    constructor(private _context: vscode.ExtensionContext,
        functionProjectPath: string,
        private _functionGraphList: FunctionGraphList) {
        
        this._staticsFolder = path.join(this._context.extensionPath, 'backend', 'DfmStatics');

        this._webViewPanel = this.showWebView(functionProjectPath);
    }

    // Closes this web view
    cleanup(): void {

        if (!!this._webViewPanel) {
            this._webViewPanel.dispose();
        }
    }

    // Path to html statics
    private _staticsFolder: string;

    // Reference to the already opened WebView with the main page
    private _webViewPanel: vscode.WebviewPanel | null = null;    

    // Functions currently shown
    private _functions: { [name: string]: any } = {};

    private static readonly ViewType = 'durableFunctionsMonitorFunctionGraph';

    // Opens a WebView with function graph page in it
    private showWebView(functionProjectPath: string): vscode.WebviewPanel {

        const title = `Function Graph (${functionProjectPath})`;

        const panel = vscode.window.createWebviewPanel(
            FunctionGraphView.ViewType,
            title,
            vscode.ViewColumn.One,
            {
                retainContextWhenHidden: true,
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(this._staticsFolder)]
            }
        );

        var html = fs.readFileSync(path.join(this._staticsFolder, 'index.html'), 'utf8');
        html = MonitorView.fixLinksToStatics(html, this._staticsFolder, panel.webview);

        html = this.embedFunctionProjectPath(html, functionProjectPath);
        html = this.embedTheme(html);

        panel.webview.html = html;

        // handle events from WebView
        panel.webview.onDidReceiveMessage(request => {

            switch (request.method) {
                case 'SaveAs':

                    // Just to be extra sure...
                    if (!MonitorView.looksLikeSvg(request.data)) {
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
                case 'TraverseFunctionProject':

                    const requestId = request.id;
                    this._functionGraphList.traverseFunctions(request.url).then(functions => {

                        this._functions = functions;

                        const iconsSvg = fs.readFileSync(path.join(this._staticsFolder, 'static', 'icons', 'all-azure-icons.svg'), 'utf8');

                        panel.webview.postMessage({
                            id: requestId, data: {
                                functions,
                                iconsSvg
                            }
                        });

                    }, err => {
                        // err might fail to serialize here, so passing err.message only
                        panel.webview.postMessage({ id: requestId, err: { message: err.message } });
                    });

                    return;
                case 'GotoFunctionCode':

                    const func = this._functions[request.url];
                    if (!!func && !!func.filePath) {
                        
                        vscode.window.showTextDocument(vscode.Uri.file(func.filePath)).then(ed => {

                            const pos = ed.document.positionAt(func.pos);

                            ed.selection = new vscode.Selection(pos, pos);
                            ed.revealRange(new vscode.Range(pos, pos));
                        });
                    }

                    return;
            }

        }, undefined, this._context.subscriptions);

        return panel;
    }

    // Embeds the current color theme
    private embedTheme(html: string): string {

        if ([2, 3].includes((vscode.window as any).activeColorTheme.kind)) {
            return html.replace('<script>var DfmClientConfig={}</script>', '<script>var DfmClientConfig={\'theme\':\'dark\'}</script>');
        }
        return html;
    }

    // Embeds the project path to be visualized
    private embedFunctionProjectPath(html: string, projectPath: string): string {

        projectPath = projectPath.replace(/\\/g, `\\\\`);

        return html.replace(
            `<script>var DfmFunctionProjectPath=""</script>`,
            `<script>var DfmFunctionProjectPath="${projectPath}"</script>`
        );
    }
}
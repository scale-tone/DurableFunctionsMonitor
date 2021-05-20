import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import { MonitorView } from './MonitorView';
import { traverseFunctionProject } from './az-func-as-a-graph/traverseFunctionProject';

// Represents the function graph view
export class FunctionGraphView
{
    constructor(private _context: vscode.ExtensionContext,
        functionProjectPath: string,
        private _log: (line: string) => void) {
        
        this._staticsFolder = path.join(this._context.extensionPath, 'backend', 'DfmStatics');

        this._webViewPanel = this.showWebView(functionProjectPath);
    }

    // Closes this web view
    cleanup(): void {

        if (!!this._webViewPanel) {
            this._webViewPanel.dispose();
        }

        for (var tempFolder of this._tempFolders) {

            this._log(`Removing ${tempFolder}`);
            try {
                rimraf.sync(tempFolder)
            } catch (err) {
                this._log(`Failed to remove ${tempFolder}: ${err.message}`);
            }
        }
    }

    // Path to html statics
    private _staticsFolder: string;

    // Reference to the already opened WebView with the main page
    private _webViewPanel: vscode.WebviewPanel | null = null;    

    // Temp folders to be removed at exit
    private _tempFolders: string[] = [];

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

        html = FunctionGraphView.embedFunctionProjectPath(html, functionProjectPath);
        html = FunctionGraphView.embedTheme(html);

        panel.webview.html = html;

        const localPathToIcons = path.join(this._staticsFolder, 'static/icons');
        const pathToIcons = panel.webview.asWebviewUri(vscode.Uri.file(localPathToIcons)).toString();

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
                    traverseFunctionProject(request.url, this._log).then(result => {

                        this._functions = result.functions;
                        this._tempFolders.push(...result.tempFolders);

                        panel.webview.postMessage({
                            id: requestId, data: {
                                functions: result.functions,
                                pathToIcons
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
    private static embedTheme(html: string): string {

        if ([2, 3].includes((vscode.window as any).activeColorTheme.kind)) {
            return html.replace('<script>var DfmClientConfig={}</script>', '<script>var DfmClientConfig={\'theme\':\'dark\'}</script>');
        }
        return html;
    }

    // Embeds the project path to be visualized
    private static embedFunctionProjectPath(html: string, projectPath: string): string {

        projectPath = projectPath.replace(/\\/g, `\\\\`);

        return html.replace(
            `<script>var DfmFunctionProjectPath=""</script>`,
            `<script>var DfmFunctionProjectPath="${projectPath}"</script>`
        );
    }
}
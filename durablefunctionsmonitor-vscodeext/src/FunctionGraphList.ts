import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { FunctionGraphView } from "./FunctionGraphView";

// Aggregates Function Graph views
export class FunctionGraphList { 

    constructor(private _context: vscode.ExtensionContext, private _logChannel?: vscode.OutputChannel) {
    }

    visualize(item?: vscode.Uri): void {

        // If host.json was clicked
        if (!!item && item.scheme === 'file' && item.fsPath.toLowerCase().endsWith('host.json')) {

            this.visualizeProjectPath(path.dirname(item.fsPath));
            return;
        }

        var defaultProjectPath = '';
        const ws = vscode.workspace;
        if (!!ws.rootPath && fs.existsSync(path.join(ws.rootPath, 'host.json'))) {
            defaultProjectPath = ws.rootPath;
        }

        vscode.window.showInputBox({ value: defaultProjectPath, prompt: 'Local path or link to GitHub repo' }).then(projectPath => {

            if (!!projectPath) {
                this.visualizeProjectPath(projectPath);
            }
        });
    }

    visualizeProjectPath(projectPath: string): void {

        const log = !this._logChannel ? (s: any) => { } : (s: any) => this._logChannel!.append(s);

        this._views.push(new FunctionGraphView(this._context, projectPath, log));
    }

    // Closes all views
    cleanup(): void {
        for (const view of this._views) {
            view.cleanup();
        }
    }

    private _views: FunctionGraphView[] = [];
}
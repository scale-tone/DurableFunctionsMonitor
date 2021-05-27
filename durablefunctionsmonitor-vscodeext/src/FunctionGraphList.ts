import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import { FunctionGraphView } from "./FunctionGraphView";
import { traverseFunctionProject } from './az-func-as-a-graph/traverseFunctionProject';
import { FunctionsMap } from './az-func-as-a-graph/FunctionsMap';

// Aggregates Function Graph views
export class FunctionGraphList {

    constructor(private _context: vscode.ExtensionContext, logChannel?: vscode.OutputChannel) {
        this._log = !logChannel ? (s: any) => { } : (s: any) => logChannel!.append(s);

        // Creating a file system watcher to cleanup current project's Functions map
        const projectPath = vscode.workspace.rootPath;
        if (!!projectPath && fs.existsSync(path.join(projectPath, 'host.json'))) {
            
            this._watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(projectPath, '**/*'));
            
            this._watcher.onDidCreate(() => { this._curProjectFunctionsMap = undefined; });
            this._watcher.onDidDelete(() => { this._curProjectFunctionsMap = undefined; });
            this._watcher.onDidChange(() => { this._curProjectFunctionsMap = undefined; });
        }
    }

    traverseFunctions(projectPath: string): Promise<FunctionsMap> {

        const isCurrentProject = projectPath === vscode.workspace.rootPath;

        if (isCurrentProject && !!this._curProjectFunctionsMap) {
            return Promise.resolve(this._curProjectFunctionsMap);
        }

        return traverseFunctionProject(projectPath, this._log).then(result => {

            this._tempFolders.push(...result.tempFolders);

            // Caching current project's functions
            if (isCurrentProject) {
                this._curProjectFunctionsMap = result.functions;
            }

            return result.functions;
        });
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

        this._views.push(new FunctionGraphView(this._context, projectPath, this));
    }

    // Closes all views
    cleanup(): void {

        if (!!this._watcher) {
            this._watcher.dispose();
        }

        for (const view of this._views) {
            view.cleanup();
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

    private _views: FunctionGraphView[] = [];
    private _curProjectFunctionsMap?: FunctionsMap;
    private _watcher?: vscode.FileSystemWatcher;
    private _tempFolders: string[] = [];
    private _log: (line: string) => void;
}
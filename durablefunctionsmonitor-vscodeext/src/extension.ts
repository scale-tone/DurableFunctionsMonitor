import * as vscode from 'vscode';

import { MonitorTreeDataProvider } from "./MonitorTreeDataProvider";

var monitorTreeDataProvider: MonitorTreeDataProvider;

export function activate(context: vscode.ExtensionContext) {

    monitorTreeDataProvider = new MonitorTreeDataProvider(context);

    context.subscriptions.push(

        vscode.commands.registerCommand('extension.durableFunctionsMonitor',
            () => monitorTreeDataProvider.showWebView()),
        
        vscode.commands.registerCommand('extension.durableFunctionsMonitorPurgeHistory',
            () => monitorTreeDataProvider.showWebView({ id: 'purgeHistory' })),

        vscode.commands.registerCommand('durableFunctionsMonitorTreeView.purgeHistory',
            (item) => monitorTreeDataProvider.attachToTaskHub(item, { id: 'purgeHistory' })),
        
        vscode.commands.registerCommand('durableFunctionsMonitorTreeView.attachToTaskHub',
            (item) => monitorTreeDataProvider.attachToTaskHub(item)),

        vscode.commands.registerCommand('durableFunctionsMonitorTreeView.detachFromTaskHub',
            (item) => monitorTreeDataProvider.detachFromTaskHub(item)),

        vscode.commands.registerCommand('durableFunctionsMonitorTreeView.attachToAnotherTaskHub',
            () => monitorTreeDataProvider.attachToAnotherTaskHub()),
        
        vscode.window.registerTreeDataProvider('durableFunctionsMonitorTreeView', monitorTreeDataProvider)
    );
}

export function deactivate() {
    return monitorTreeDataProvider.cleanup();
}
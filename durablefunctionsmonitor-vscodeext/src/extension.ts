import * as vscode from 'vscode';

import { MonitorView } from "./MonitorView";

var durableFunctionsMonitor: MonitorView;

export function activate(context: vscode.ExtensionContext) {

    durableFunctionsMonitor =  new MonitorView(context);

    context.subscriptions.push(

        vscode.commands.registerCommand('extension.durableFunctionsMonitor',
            () => durableFunctionsMonitor.show()),
        
        vscode.commands.registerCommand('extension.durableFunctionsMonitorPurgeHistory',
            () => durableFunctionsMonitor.show({ id: 'purgeHistory' }))
    );
}

export function deactivate() {
    return durableFunctionsMonitor.cleanup();
}

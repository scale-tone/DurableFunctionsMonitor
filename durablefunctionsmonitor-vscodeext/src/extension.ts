import * as vscode from 'vscode';

import { DurableFunctionsMonitor } from "./DurableFunctionsMonitor";

var durableFunctionsMonitor: DurableFunctionsMonitor;

export function activate(context: vscode.ExtensionContext) {

    durableFunctionsMonitor =  new DurableFunctionsMonitor(context);

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

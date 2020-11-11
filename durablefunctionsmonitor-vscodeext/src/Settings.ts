import * as vscode from 'vscode';

export function Settings(): ISettings {
    return (vscode.workspace.getConfiguration('Durable Functions Monitor') as any) as ISettings;
}

interface ISettings
{
    backendBaseUrl: string;
    backendTimeoutInSeconds: number;
    enableLogging: boolean;
}
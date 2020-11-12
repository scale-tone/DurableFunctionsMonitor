import * as vscode from 'vscode';

// Returns config values stored in VsCode's settings.json
export function Settings(): ISettings {

    const config = vscode.workspace.getConfiguration('durableFunctionsMonitor');

    // Better to have default values hardcoded here (not only in package.json) as well
    return {
        backendBaseUrl: config.get<string>('backendBaseUrl', 'http://localhost:{portNr}/a/p/i'),
        backendTimeoutInSeconds: config.get<number>('backendTimeoutInSeconds', 60),
        enableLogging: config.get<boolean>('enableLogging', false)
    };
}

interface ISettings
{
    backendBaseUrl: string;
    backendTimeoutInSeconds: number;
    enableLogging: boolean;
}
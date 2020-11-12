import * as vscode from 'vscode';

// Returns config values stored in VsCode's settings.json
export function Settings(): ISettings {

    const config = vscode.workspace.getConfiguration('durableFunctionsMonitor');

    // Better to have default values hardcoded here (not only in package.json) as well
    return {
        backendBaseUrl: config.get<string>('backendBaseUrl', 'http://localhost:{portNr}/a/p/i'),
        backendTimeoutInSeconds: config.get<number>('backendTimeoutInSeconds', 60),
        storageEmulatorConnectionString: config.get<string>('storageEmulatorConnectionString', 'AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;DefaultEndpointsProtocol=http;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;QueueEndpoint=http://127.0.0.1:10001/devstoreaccount1;TableEndpoint=http://127.0.0.1:10002/devstoreaccount1;'),
        enableLogging: config.get<boolean>('enableLogging', false)
    };
}

interface ISettings
{
    backendBaseUrl: string;
    backendTimeoutInSeconds: number;
    storageEmulatorConnectionString: string;
    enableLogging: boolean;
}
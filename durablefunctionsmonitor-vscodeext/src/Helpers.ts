import * as CryptoJS from 'crypto-js';

import { Settings } from './Settings';

export class ConnStringUtils {
    
    // Extracts AccountName from Storage Connection String
    static GetAccountName(connString: string): string {
        const match = /AccountName=([^;]+)/i.exec(connString);
        return (!!match && match.length > 0) ? match[1] : '';
    }

    // Extracts AccountKey from Storage Connection String
    static GetAccountKey(connString: string): string {
        const match = /AccountKey=([^;]+)/i.exec(connString);
        return (!!match && match.length > 0) ? match[1] : '';
    }

    // Extracts DefaultEndpointsProtocol from Storage Connection String
    static GetDefaultEndpointsProtocol(connString: string): string {
        const match = /DefaultEndpointsProtocol=([^;]+)/i.exec(connString);
        return (!!match && match.length > 0) ? match[1] : 'https';
    }

    // Extracts TableEndpoint from Storage Connection String
    static GetTableEndpoint(connString: string): string {

        const accountName = ConnStringUtils.GetAccountName(connString);
        if (!accountName) {
            return '';
        }

        const endpointsProtocol = ConnStringUtils.GetDefaultEndpointsProtocol(connString);

        const suffixMatch = /EndpointSuffix=([^;]+)/i.exec(connString);
        if (!!suffixMatch && suffixMatch.length > 0) {

            return `${endpointsProtocol}://${accountName}.table.${suffixMatch[1]}/`;
        }

        const endpointMatch = /TableEndpoint=([^;]+)/i.exec(connString);
        return (!!endpointMatch && endpointMatch.length > 0) ? endpointMatch[1] : `${endpointsProtocol}://${accountName}.table.core.windows.net/`;
    }

    // Replaces 'UseDevelopmentStorage=true' with full Storage Emulator connection string
    static ExpandEmulatorShortcutIfNeeded(connString: string): string {

        if (connString.includes('UseDevelopmentStorage=true')) {
            return Settings().storageEmulatorConnectionString;
        }

        return connString;
    }
}

// Creates the SharedKeyLite signature to query Table Storage REST API, also adds other needed headers
export function CreateAuthHeadersForTableStorage(accountName: string, accountKey: string, queryUrl: string): { } {

    const dateInUtc = new Date().toUTCString();
    const signature = CryptoJS.HmacSHA256(`${dateInUtc}\n/${accountName}/${queryUrl}`, CryptoJS.enc.Base64.parse(accountKey));

    return {
        'Authorization': `SharedKeyLite ${accountName}:${signature.toString(CryptoJS.enc.Base64)}`,
        'x-ms-date': dateInUtc,
        'x-ms-version': '2015-12-11'
    };
}
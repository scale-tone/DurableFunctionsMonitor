import * as CryptoJS from 'crypto-js';

// Extracts AccountName from Storage Connection String
export function GetAccountNameFromConnectionString(connString: string): string {
    const match = /AccountName=([^;]+)/i.exec(connString);
    return (!!match && match.length > 0) ? match[1] : '';
}

// Extracts AccountKey from Storage Connection String
export function GetAccountKeyFromConnectionString(connString: string): string {
    const match = /AccountKey=([^;]+)/i.exec(connString);
    return (!!match && match.length > 0) ? match[1] : '';
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
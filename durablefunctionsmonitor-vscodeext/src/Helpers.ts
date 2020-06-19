
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
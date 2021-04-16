
const MaxJsonLengthToShow = 1024;

export function renderJson(json: any): string {

    if (!json) {
        return '';
    }

    const result = JSON.stringify(json);
    return result.length > MaxJsonLengthToShow ? `[${result.length} symbols long JSON]` : result;
}

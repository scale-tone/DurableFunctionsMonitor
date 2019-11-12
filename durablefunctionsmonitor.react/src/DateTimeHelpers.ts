
export class DateTimeHelpers
{
    public static getDateTimeValue(evt: any): Date {

        var dt = new Date(evt.target.value.slice(0, 16) + ':00Z');

        // If invalid date entered, then setting it to current date
        try {
            dt.toISOString();
        } catch (err) {
            dt = new Date();
        }

        return dt;
    }

    public static formatDateTime(dt: Date) {
        return dt.toISOString().slice(0, 16);
    }
}
import moment from 'moment';

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

    public static momentAsUtc(t: moment.Moment): moment.Moment {
        
        if (!t || !t.isValid()) {
            return t;
        }

        // Need to convert to UTC, because @material-ui/pickers always give us local moments
        const result = moment(t.toISOString(true).slice(0, 19) + 'Z');
        result.utc();
        return result;
    }

    // This is the default range for @material-ui/pickers
    private static MinMoment = moment('1900-01-01').utc();
    private static MaxMoment = moment('2100-01-01').utc();

    public static isValidMoment(t: moment.Moment): boolean {
        return !!t && t.isValid() && t.isAfter(DateTimeHelpers.MinMoment) && t.isBefore(DateTimeHelpers.MaxMoment);
    }

    public static formatDateTime(dt: Date) {
        return dt.toISOString().slice(0, 16);
    }
}
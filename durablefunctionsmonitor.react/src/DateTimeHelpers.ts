import moment from 'moment';

export class DateTimeHelpers
{
    // Prepares a moment for visualizing with @material-ui/pickers
    public static getMoment(t: moment.Moment, showTimeAsLocal: boolean): moment.Moment {

        if (!t || !t.isValid()) {
            return t;
        }

        // Need to call either .utc() or .local() on moment value, to make it _render_ correctly.
        if (!showTimeAsLocal) {
            t.utc();
        } else {
            t.local();
        }

        return t;
    }

    // Converts a moment taken from @material-ui/pickers
    public static setMoment(t: moment.Moment, showTimeAsLocal: boolean): moment.Moment {

        if (!t || !t.isValid() || !!showTimeAsLocal) {
            return t;
        }

        // Need to convert to UTC, because @material-ui/pickers always give us local moments
        return moment(t.toISOString(true).slice(0, 19) + 'Z');
    }

    // This is the default range for @material-ui/pickers
    private static MinMoment = moment('1900-01-01').utc();
    private static MaxMoment = moment('2100-01-01').utc();

    public static isValidMoment(t: moment.Moment): boolean {
        return !!t && t.isValid() && t.isAfter(DateTimeHelpers.MinMoment) && t.isBefore(DateTimeHelpers.MaxMoment);
    }
}
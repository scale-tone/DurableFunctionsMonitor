import moment from 'moment';

export class DateTimeHelpers
{
    // This is the default range for @material-ui/pickers
    private static MinMoment = moment('1900-01-01');
    private static MaxMoment = moment('2100-01-01');

    public static isValidMoment(t: moment.Moment): boolean {
        return !!t && t.isValid() && t.isAfter(DateTimeHelpers.MinMoment) && t.isBefore(DateTimeHelpers.MaxMoment);
    }
}
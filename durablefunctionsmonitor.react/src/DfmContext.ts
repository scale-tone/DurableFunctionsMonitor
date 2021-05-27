import * as React from 'react';
import { observable, computed } from 'mobx'
import moment from 'moment';

// Config object passed as a global variable via index.html
declare const DfmClientConfig: {
    theme: string,
    showTimeAs: string
};

// Global observable context object with global settings and other cross-cutting concerns in it
export class DfmContext {

    get theme(): string { return DfmClientConfig.theme; }

    @computed
    get showTimeAsLocal(): boolean {
        return this._showTimeAsLocal;
    }
    set showTimeAsLocal(val) {
        localStorage?.setItem('showTimeAs', val ? 'Local' : 'UTC');
        this._showTimeAsLocal = val;
    }

    constructor() {
        if (DfmClientConfig.showTimeAs !== 'Local') {
            this._showTimeAsLocal = localStorage?.getItem('showTimeAs') === 'Local';
        } else {
            this._showTimeAsLocal = true;
        }
    }

    // Prepares a moment for visualizing with @material-ui/pickers
    public getMoment(t: moment.Moment): moment.Moment {

        if (!t || !t.isValid()) {
            return t;
        }

        // Need to call either .utc() or .local() on moment value, to make it _render_ correctly.
        if (!this._showTimeAsLocal) {
            t.utc();
        } else {
            t.local();
        }

        return t;
    }

    // Converts a moment taken from @material-ui/pickers
    public setMoment(t: moment.Moment): moment.Moment {

        if (!t || !t.isValid() || !!this._showTimeAsLocal) {
            return t;
        }

        // Need to convert to UTC, because @material-ui/pickers always give us local moments
        return moment(t.toISOString(true).slice(0, 19) + 'Z');
    }

    public formatDateTimeString(utcString: string): string {

        if (!this._showTimeAsLocal || !utcString || utcString.length < 11) {
            return utcString;
        }

        // need to handle milliseconds separately (because it might also be microseconds, and those are omitted by moment)
        const dotPoint = utcString.lastIndexOf('.');
        const milliseconds = (dotPoint >= 0) ? '.' + utcString.substring(dotPoint + 1, utcString.length - 1) : '';

        return moment(utcString).format(`YYYY-MM-DDTHH:mm:ss`) + milliseconds;
    }

    @observable
    private _showTimeAsLocal;
}

export const DfmContextType = React.createContext<DfmContext>(new DfmContext());
export const dfmContextInstance = new DfmContext();
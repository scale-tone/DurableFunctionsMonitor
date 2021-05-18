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

    get theme(): string { return DfmClientConfig.theme;}

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
import { observable, computed } from 'mobx'

import { IBackendClient } from '../services/IBackendClient';
import { RuntimeStatus } from './DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';


// State of Purge History Dialog
export class PurgeHistoryDialogState extends ErrorMessageState {

    @computed
    get dialogOpen(): boolean { return this._dialogOpen; };
    set dialogOpen(value: boolean) {
        this._dialogOpen = value;

        if (value) {

            this._instancesDeleted = null;

            var timeFrom: Date = new Date();
            timeFrom.setDate(timeFrom.getDate() - 1);
            this.timeFrom = timeFrom;

            this.timeTill = new Date();

            this._statuses = new Set<RuntimeStatus>(["Completed", "Terminated"]);
        }
    }

    @computed
    get instancesDeleted(): number | null { return this._instancesDeleted; };

    @computed
    get inProgress(): boolean { return this._inProgress; };

    @computed
    get isValid(): boolean { return this._statuses.size > 0; };

    constructor(private _backendClient: IBackendClient) {
        super();
    }

    purgeHistory() {

        this._inProgress = true;

        this._backendClient.call('POST', '/purge-history', {
            timeFrom: this.timeFrom,
            timeTill: this.timeTill,
            statuses: Array.from(this._statuses.values())
        }).then(response => {

            this._instancesDeleted = response.instancesDeleted;

        }, err => {
            this.errorMessage = `Purge history failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    @observable
    timeFrom: Date = new Date();
    @observable
    timeTill: Date = new Date();

    getStatusIncluded(status: RuntimeStatus) {
        return this._statuses.has(status);
    }

    setStatusIncluded(status: RuntimeStatus, included: boolean) {
        if (included) {
            this._statuses.add(status);
        } else {
            this._statuses.delete(status);
        }
    }

    @observable
    private _statuses: Set<RuntimeStatus> = new Set<RuntimeStatus>();

    @observable
    private _dialogOpen: boolean = false;
    
    @observable
    private _inProgress: boolean = false;

    @observable
    private _instancesDeleted: number | null = null;
}
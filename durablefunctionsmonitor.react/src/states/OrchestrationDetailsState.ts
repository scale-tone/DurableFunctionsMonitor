import { observable, computed } from 'mobx'

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    details: DurableOrchestrationStatus = new DurableOrchestrationStatus();

    @computed
    get orchestrationId(): string { return this._orchestrationId; }

    @computed
    get inProgress(): boolean { return this._inProgress; };

    @computed
    get autoRefresh(): number { return this._autoRefresh; }
    set autoRefresh(val: number) {
        this._autoRefresh = val;
        this.loadDetails();
    }

    @computed
    get raiseEventDialogOpen(): boolean { return this._sendEventDialogOpen; }
    set raiseEventDialogOpen(val: boolean) {
        this._sendEventDialogOpen = val;
        this.eventName = '';
        this.eventData = '';
    }

    @observable
    rewindConfirmationOpen: boolean = false;
    @observable
    terminateConfirmationOpen: boolean = false;
    @observable
    eventName: string;
    @observable
    eventData: string;

    constructor(private _orchestrationId: string, private _backendClient: IBackendClient) {
        super();
    }

    rewind() {
        this.rewindConfirmationOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/rewind`;
        this._inProgress = true;

        this._backendClient.call('POST', uri).then(() => {
            this.loadDetails();
        }, err => {
            this.errorMessage = `Failed to rewind: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    terminate() {
        this.terminateConfirmationOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/terminate`;
        this._inProgress = true;

        this._backendClient.call('POST', uri).then(() => {
            this.loadDetails();
        }, err => {
            this.errorMessage = `Failed to terminate: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    raiseEvent() {

        const uri = `/orchestrations('${this._orchestrationId}')/raise-event`;
        const requestBody = { name: this.eventName, data: null };

        try {
            requestBody.data = JSON.parse(this.eventData);
        } catch (err) {
            this.errorMessage = `Event Data failed to parse: ${err.message}`;
            return;
        } finally {
            this.raiseEventDialogOpen = false;
        }

        this._inProgress = true;

        this._backendClient.call('POST', uri, requestBody).then(() => {
            this.loadDetails();
        }, err => {
            this.errorMessage = `Failed to raise an event: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    loadDetails() {

        if (!!this.inProgress) {
            return;
        }
        this._inProgress = true;

        const uri = `/orchestrations('${this._orchestrationId}')`;

        this._backendClient.call('GET', uri).then(response => {

            if (!response) {
                this.errorMessage = `Orchestration '${this._orchestrationId}' not found.`;

                // Cancelling auto-refresh just in case
                this._autoRefresh = 0;
                return;
            }

            this.details = response;

            // Doing auto-refresh
            if (!!this._autoRefresh) {

                if (!!this._autoRefreshToken) {
                    clearTimeout(this._autoRefreshToken);
                }
                this._autoRefreshToken = setTimeout(() => this.loadDetails(), this._autoRefresh * 1000);
            }

        }, err => {

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;

        }).finally(() => {
            this._inProgress = false;
        });
    }

    @observable
    private _inProgress: boolean = false;
    @observable
    _sendEventDialogOpen: boolean = false;
    @observable
    private _autoRefresh: number = 0;

    private _autoRefreshToken: NodeJS.Timeout;
}
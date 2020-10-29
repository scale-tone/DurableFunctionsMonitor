import { observable, computed } from 'mobx'

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    @observable
    details: DurableOrchestrationStatus = new DurableOrchestrationStatus();

    @computed
    get orchestrationId(): string { return this._orchestrationId; }

    @computed
    get inProgress(): boolean { return this._inProgress; };

    @computed
    get autoRefresh(): number { return this._autoRefresh; }
    set autoRefresh(val: number) {
        this._autoRefresh = val;
        this._localStorage.setItem('autoRefresh', this._autoRefresh.toString());
        this.loadDetails();
    }

    @computed
    get raiseEventDialogOpen(): boolean { return this._raiseEventDialogOpen; }
    set raiseEventDialogOpen(val: boolean) {
        this._raiseEventDialogOpen = val;
        this.eventName = '';
        this.eventData = '';
    }

    @computed
    get setCustomStatusDialogOpen(): boolean { return this._setCustomStatusDialogOpen; }
    set setCustomStatusDialogOpen(val: boolean) {
        this._setCustomStatusDialogOpen = val;
        this.newCustomStatus = !!this.details.customStatus ? JSON.stringify(this.details.customStatus) : '';
    }

    @computed
    get isCustomStatusDirty(): boolean { 

        if (!this.details.customStatus) {
            return !!this.newCustomStatus;
        }

        return this.newCustomStatus !== JSON.stringify(this.details.customStatus);
    }

    @observable
    rewindConfirmationOpen: boolean = false;
    @observable
    terminateConfirmationOpen: boolean = false;
    @observable
    purgeConfirmationOpen: boolean = false;

    @observable
    eventName: string;
    @observable
    eventData: string;
    @observable
    newCustomStatus: string;

    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(private _orchestrationId: string,
        private _backendClient: IBackendClient,
        private _localStorage: ITypedLocalStorage<OrchestrationDetailsState>) {
        super();

        const autoRefreshString = this._localStorage.getItem('autoRefresh');
        if (!!autoRefreshString) {
            this._autoRefresh = Number(autoRefreshString);
        }
    }

    rewind() {
        this.rewindConfirmationOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/rewind`;
        this._inProgress = true;

        this._backendClient.call('POST', uri).then(() => {
            this._inProgress = false;
            this.loadDetails();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to rewind: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    terminate() {
        this.terminateConfirmationOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/terminate`;
        this._inProgress = true;

        this._backendClient.call('POST', uri).then(() => {
            this._inProgress = false;
            this.loadDetails();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to terminate: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    purge() {
        this.purgeConfirmationOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/purge`;
        this._inProgress = true;

        this._backendClient.call('POST', uri).then(() => {
            this._inProgress = false;
            this.details = new DurableOrchestrationStatus();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to purge: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    raiseEvent() {

        const uri = `/orchestrations('${this._orchestrationId}')/raise-event`;
        const requestBody = { name: this.eventName, data: null };

        try {
            requestBody.data = JSON.parse(this.eventData);
        } catch (err) {
            this.errorMessage = `Failed to parse event data: ${err.message}`;
            return;
        } finally {
            this.raiseEventDialogOpen = false;
        }

        this._inProgress = true;

        this._backendClient.call('POST', uri, requestBody).then(() => {
            this._inProgress = false;
            this.loadDetails();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to raise an event: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    setCustomStatus() {

        const uri = `/orchestrations('${this._orchestrationId}')/set-custom-status`;
        var requestBody = null;

        try {

            if (!!this.newCustomStatus) {
                requestBody = JSON.parse(this.newCustomStatus);
            }

        } catch (err) {
            this.errorMessage = `Failed to parse custom status: ${err.message}`;
            return;
        } finally {
            this.setCustomStatusDialogOpen = false;
        }

        this._inProgress = true;

        this._backendClient.call('POST', uri, requestBody).then(() => {
            this._inProgress = false;
            this.loadDetails();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to set custom status: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }
    
    loadDetails() {

        if (!!this.inProgress) {
            return;
        }
        this._inProgress = true;

        const uri = `/orchestrations('${this._orchestrationId}')`;
        const subOrchestrationsUri = uri + '/suborchestrations';

        // Trying to get both details and suborchestrations
        Promise.all([this._backendClient.call('GET', uri), this._backendClient.call('GET', subOrchestrationsUri)]).then(responses => {

            const response = responses[0];

            if (!response) {
                this.errorMessage = `Orchestration '${this._orchestrationId}' not found.`;

                // Cancelling auto-refresh just in case
                this._autoRefresh = 0;
                return;
            }

            // Based on backend implementation, this field can appear to be called differently ('historyEvents' vs. 'history')
            // Fixing that here
            if (!!response.history) {
                response.historyEvents = response.history;
            }

            if (response.entityType === "Orchestration") {

                // Trying to correlate suborchestrations
                const subOrchestrationsResponse: any[] = responses[1];
                
                const subOrchestrationsHistory: any[] = response.historyEvents
                    .filter(he => he.EventType === 'SubOrchestrationInstanceCompleted');

                for (const subOrchestration of subOrchestrationsResponse) {

                    const eventItemIndex = subOrchestrationsHistory
                        .findIndex(he => he.FunctionName === subOrchestration.subOrchestrationName
                            && he.ScheduledTime === subOrchestration.scheduledTime);

                    if (eventItemIndex < 0) {
                        continue;
                    }

                    const eventItem = subOrchestrationsHistory[eventItemIndex];

                    eventItem.subOrchestrationId = subOrchestration.instanceId;

                    // Dropping this line, so that multiple suborchestrations are correlated correctly
                    subOrchestrationsHistory.splice(eventItemIndex, 1);
                }
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
    _raiseEventDialogOpen: boolean = false;
    @observable
    _setCustomStatusDialogOpen: boolean = false;
    @observable
    private _autoRefresh: number = 0;

    private _autoRefreshToken: NodeJS.Timeout;
}
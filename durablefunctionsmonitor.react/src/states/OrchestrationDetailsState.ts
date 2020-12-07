import { observable, computed } from 'mobx';

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';
import { SequenceDiagramTabState } from './SequenceDiagramTabState';
import { LiquidMarkupTabState } from './LiquidMarkupTabState';

// Represents states of custom tabs
export interface ICustomTabState {

    name: string;
    description: string;
    rawHtml: string;

    load(details: DurableOrchestrationStatus): Promise<void>;
}

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    // Tab currently selected
    @computed
    get selectedTabIndex(): number { return this._selectedTabIndex; }
    set selectedTabIndex(val: number) {

        this._selectedTabIndex = val;
        this.loadCustomTabIfNeeded();
    }

    get selectedTab(): ICustomTabState {
        return !this._selectedTabIndex ? null : this._tabStates[this._selectedTabIndex - 1];
    }

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
    get restartDialogOpen(): boolean { return this._restartDialogOpen; }
    set restartDialogOpen(val: boolean) {
        this._restartDialogOpen = val;
        this.restartWithNewInstanceId = true;
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
    @observable
    restartWithNewInstanceId: boolean = true;

    @computed
    get tabStates(): ICustomTabState[] { return this._tabStates; }

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

    restart() {
        this.restartDialogOpen = false;

        const uri = `/orchestrations('${this._orchestrationId}')/restart`;
        const requestBody = { restartWithNewInstanceId: this.restartWithNewInstanceId };

        this._inProgress = true;

        this._backendClient.call('POST', uri, requestBody).then(() => {
            this._inProgress = false;
            this.loadDetails();
        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to restart: ${err.message}.${(!!err.response ? err.response.data : '')} `;
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
            // Doing auto-refresh
            this.setAutoRefresh();
            return;
        }
        this._inProgress = true;
        this._tabStates = [];

        this.internalLoadDetails(this._orchestrationId).then(response => {
        
            this.details = response;

            // Doing auto-refresh
            this.setAutoRefresh();

            // Loading custom tabs
            if (this.details.entityType === "Orchestration") {
                
                this._tabStates.push(new SequenceDiagramTabState((orchId) => this.internalLoadDetails(orchId)));
            }
            if (!!this.details.tabTemplateNames) {
                for (var templateName of this.details.tabTemplateNames) {
                    this._tabStates.push(new LiquidMarkupTabState(templateName, this._orchestrationId, this._backendClient));
                }                
            }

            this._inProgress = false;

            // Reloading the current custom tab as well
            this.loadCustomTabIfNeeded();
            
        }, err => {
            this._inProgress = false;

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    private loadCustomTabIfNeeded(): void {

        if (!!this._inProgress || !this._selectedTabIndex) {
            return;
        }

        this._inProgress = true;

        this.selectedTab.load(this.details).then(() => {}, err => { 
                
            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Failed to load Sequence Diagram: ${err.message}.${(!!err.response ? err.response.data : '')} `;

        }).finally(() => {
            this._inProgress = false;
        });
    }

    private setAutoRefresh(): void {

        if (!this._autoRefresh) {
            return;
        }

        if (!!this._autoRefreshToken) {
            clearTimeout(this._autoRefreshToken);
        }
        this._autoRefreshToken = setTimeout(() => this.loadDetails(), this._autoRefresh * 1000);
    }

    @observable
    private _tabStates: ICustomTabState[] = [];

    @observable
    private _selectedTabIndex: number = 0;
    @observable
    private _inProgress: boolean = false;
    @observable
    private _raiseEventDialogOpen: boolean = false;
    @observable
    private _setCustomStatusDialogOpen: boolean = false;
    @observable
    private _restartDialogOpen: boolean = false;
    @observable
    private _autoRefresh: number = 0;

    private _autoRefreshToken: NodeJS.Timeout;

    private internalLoadDetails(orchestrationId: string): Promise<DurableOrchestrationStatus> {

        const uri = `/orchestrations('${orchestrationId}')`;
        return this._backendClient.call('GET', uri).then(response => {

            if (!response) {
                throw { message: `Orchestration '${orchestrationId}' not found.` };
            }

            // Based on backend implementation, this field can appear to be called differently ('historyEvents' vs. 'history')
            // Fixing that here
            if (!!response.history) {
                response.historyEvents = response.history;
            }

            return response;
        });
    }
}
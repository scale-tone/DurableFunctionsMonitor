import { observable, computed } from 'mobx';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';
import { SequenceDiagramTabState } from './SequenceDiagramTabState';
import { ICustomTabState } from './ICustomTabState';
import { GanttDiagramTabState } from './GanttDiagramTabState';
import { LiquidMarkupTabState } from './LiquidMarkupTabState';

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    // Tab currently selected
    @computed
    get selectedTabIndex(): number { return this._selectedTabIndex; }
    set selectedTabIndex(val: number) {

        if (this._selectedTabIndex === val) {
            return;
        }

        this._selectedTabIndex = val;
        this.loadCustomTabIfNeeded();
    }

    get selectedTab(): ICustomTabState {
        return !this._selectedTabIndex ? null : this._tabStates[this._selectedTabIndex - 1];
    }

    @computed
    get details(): DurableOrchestrationStatus { return this._details; }

    @computed
    get history(): HistoryEvent[] { return this._history; }

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
        this.newCustomStatus = !!this._details.customStatus ? JSON.stringify(this._details.customStatus) : '';
    }

    @computed
    get restartDialogOpen(): boolean { return this._restartDialogOpen; }
    set restartDialogOpen(val: boolean) {
        this._restartDialogOpen = val;
        this.restartWithNewInstanceId = true;
    }

    @computed
    get isCustomStatusDirty(): boolean { 

        if (!this._details.customStatus) {
            return !!this.newCustomStatus;
        }

        return this.newCustomStatus !== JSON.stringify(this._details.customStatus);
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
            this._history = [];
            this._details = new DurableOrchestrationStatus();
            this._tabStates = [];
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

    showMoreHistory() {
        
        if (!this._details.historyEvents) {
            this._history = [];
            return;
        }

        const nextBatch = this._details.historyEvents.slice(this._historyPageNr * this._historyPageSize, (this._historyPageNr + 1) * this._historyPageSize);
        if (!!nextBatch.length) {
            
            if (this._historyPageNr === 0) {
                this._history = nextBatch;                
            } else {
                this._history.push(...nextBatch);
            }

            this._historyPageNr++;
        }
    }
    
    loadDetails() {

        if (!!this.inProgress) {
            // Doing auto-refresh
            this.setAutoRefresh();
            return;
        }
        this._inProgress = true;

        this.internalLoadDetails(this._orchestrationId).then(response => {
        
            this._details = response;

            // Showing first batch of history events
            this._historyPageNr = 0;
            this.showMoreHistory();

            // Doing auto-refresh
            this.setAutoRefresh();

            var tabStateIndex = 0;

            // Loading sequence diagram tab
            if (this._details.entityType === "Orchestration") {
               
                if (this._tabStates.length <= tabStateIndex) {
                    this._tabStates.push(new SequenceDiagramTabState((orchId) => this.internalLoadDetails(orchId)));
                    this._tabStates.push(new GanttDiagramTabState((orchId) => this.internalLoadDetails(orchId)));
                }
                tabStateIndex += 2;
            }

            // Loading custom tabs
            if (!!this._details.tabTemplateNames) {
                for (var templateName of this._details.tabTemplateNames) {

                    if (this._tabStates.length <= tabStateIndex) {
                        this._tabStates.push(new LiquidMarkupTabState(this._orchestrationId, this._backendClient));
                    }
                    this._tabStates[tabStateIndex].name = templateName;
                    tabStateIndex++;
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

        if (!!this._inProgress || !this.selectedTab) {
            return;
        }

        this._inProgress = true;

        this.selectedTab.load(this._details).then(() => {}, err => { 
                
            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Failed to load tab: ${err.message}.${(!!err.response ? err.response.data : '')} `;

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
    private _details: DurableOrchestrationStatus = new DurableOrchestrationStatus();
    @observable
    private _history: HistoryEvent[] = [];
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
    private _historyPageNr = 0;
    private readonly _historyPageSize = 200;

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
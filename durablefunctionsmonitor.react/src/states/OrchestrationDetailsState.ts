import { observable, computed } from 'mobx';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';
import { SequenceDiagramTabState } from './SequenceDiagramTabState';
import { ICustomTabState } from './ICustomTabState';
import { GanttDiagramTabState } from './GanttDiagramTabState';
import { LiquidMarkupTabState } from './LiquidMarkupTabState';
import { CancelToken } from '../CancelToken';

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    // Tab currently selected
    @computed
    get tabIndex(): number { return this._tabIndex; }
    set tabIndex(val: number) {

        if (this._tabIndex === val) {
            return;
        }

        this._tabIndex = val;
        this._localStorage.setItem('tabIndex', val.toString());

        if (!!this.selectedTab) {

            this.loadCustomTab();

        } else if (!this._history.length) {

            this.loadHistory();
        }
    }

    get selectedTab(): ICustomTabState {
        return !this._tabIndex ? null : this._tabStates[this._tabIndex - 1];
    }

    @computed
    get details(): DurableOrchestrationStatus { return this._details; }

    @computed
    get history(): HistoryEvent[] { return this._history; }

    @computed
    get historyTotalCount(): number { return this._historyTotalCount; }

    @computed
    get orchestrationId(): string { return this._orchestrationId; }

    @computed
    get loadInProgress(): boolean { return this._cancelToken.inProgress && !this._cancelToken.isCancelled; }

    @computed
    get inProgress(): boolean { return this._inProgress || this.loadInProgress; };

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

    @computed
    get functionNames(): { [name: string]: any } { return this._functionNames; };

    @computed
    get functionName(): string { return DurableOrchestrationStatus.getFunctionName(this._details) };

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
        projectPath: string,
        private _backendClient: IBackendClient,
        private _localStorage: ITypedLocalStorage<OrchestrationDetailsState>) {
        super();

        const autoRefreshString = this._localStorage.getItem('autoRefresh');
        if (!!autoRefreshString) {
            this._autoRefresh = Number(autoRefreshString);
        }

        const tabIndexString = this._localStorage.getItem('tabIndex');
        if (!!tabIndexString) {
            this._tabIndex = Number(tabIndexString);
        }

        // If we're inside VsCode and the currently opened project is a Functions project
        if (!!projectPath) {

            // trying to parse the project and get function names out of it
            this._backendClient.call('TraverseFunctionProject', projectPath).then(response => {

                this._functionNames = response.functions;

            }, err => {
                console.log(`Failed to traverse: ${err.message}.${(!!err.response ? err.response.data : '')} `);
            });
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

    loadDetails() {

        if (!!this.inProgress) { // We might end up here, if next timer occurs while a custom tab is still loading
            // Doing auto-refresh
            this.setAutoRefresh();
            return;
        }

        this._inProgress = true;
        this._noMorePagesToLoad = false;

        if (!this._autoRefresh && (!this.selectedTab)) {
            
            this._history = [];
            this._historyTotalCount = 0;
        }

        const uri = `/orchestrations('${this._orchestrationId}')`;
        return this._backendClient.call('GET', uri).then(response => {
        
            this._details = response;

            // Doing auto-refresh
            this.setAutoRefresh();

            var tabStateIndex = 0;

            // Loading sequence diagram tab
            if (this._details.entityType === "Orchestration") {
               
                if (this._tabStates.length <= tabStateIndex) {
                    this._tabStates.push(new SequenceDiagramTabState((orchId) => this.loadAllHistory(orchId)));
                    this._tabStates.push(new GanttDiagramTabState((orchId) => this.loadAllHistory(orchId)));
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

            // Ensuring tab index does not go out of sync
            if (this._tabIndex < 0 || this._tabIndex > this._tabStates.length) {
                this._tabIndex = 0;
            }

            this._inProgress = false;

            if (!this.selectedTab) {
                
                this.loadHistory(!!this._autoRefresh);

            } else {

                this.loadCustomTab();
            }
            
        }, err => {
            this._inProgress = false;

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    cancel() {
        this._cancelToken.isCancelled = true;
        this._cancelToken = new CancelToken();
    }

    loadHistory(isAutoRefresh: boolean = false): void {

        if (!!this.inProgress || !!this.selectedTab || !!this._noMorePagesToLoad) {
            return;
        }

        const cancelToken = this._cancelToken;
        cancelToken.inProgress = true;

        // In auto-refresh mode only refreshing the first page
        const skip = isAutoRefresh ? 0 : this._history.length;

        const uri = `/orchestrations('${this._orchestrationId}')/history?$top=${this._pageSize}&$skip=${skip}`;

        this._backendClient.call('GET', uri).then(response => {

            if (cancelToken.isCancelled) {
                return;
            }

            this._historyTotalCount = response.totalCount;

            if (isAutoRefresh) {
                this._history = response.history;
            } else {
                this._history.push(...response.history);

                if (response.history.length < this._pageSize) {

                    // Stop the infinite scrolling
                    this._noMorePagesToLoad = true;
                }
            }
        }, err => {

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            if (!cancelToken.isCancelled) {
                this.errorMessage = `Failed to load history: ${err.message}.${(!!err.response ? err.response.data : '')} `;
            }

        }).finally(() => {
            cancelToken.inProgress = false;
        });
    }

    gotoFunctionCode(functionName: string): void {

        this.backendClient.call('GotoFunctionCode', functionName).then(() => {}, err => {
            console.log(`Failed to goto function code: ${err.message}`);
        });
    }

    showFunctionsGraph(): void {

        this.backendClient.call('VisualizeFunctionsAsAGraph', '').then(() => {}, err => {
            console.log(`Failed to goto functions graph: ${err.message}`);
        });
    }

    private loadCustomTab(): void {

        if (!!this.inProgress) {
            return;
        }

        const cancelToken = this._cancelToken;
        cancelToken.inProgress = true;

        this.selectedTab.load(this._details, cancelToken).then(() => {}, err => { 
                
            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            if (!cancelToken.isCancelled) {
                this.errorMessage = `Failed to load tab: ${err.message}.${(!!err.response ? err.response.data : '')} `;
            }

        }).finally(() => {
            cancelToken.inProgress = false;
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

    private loadAllHistory(orchestrationId: string): Promise<HistoryEvent[]> {

        const uri = `/orchestrations('${orchestrationId}')/history`;
        return this._backendClient.call('GET', uri).then(response => response.history);
    }

    @observable
    private _tabStates: ICustomTabState[] = [];

    @observable
    private _details: DurableOrchestrationStatus = new DurableOrchestrationStatus();
    @observable
    private _history: HistoryEvent[] = [];
    @observable
    private _tabIndex: number = 0;
    @observable
    private _inProgress: boolean = false;
    @observable
    private _cancelToken: CancelToken = new CancelToken();
    @observable
    private _raiseEventDialogOpen: boolean = false;
    @observable
    private _setCustomStatusDialogOpen: boolean = false;
    @observable
    private _restartDialogOpen: boolean = false;
    @observable
    private _autoRefresh: number = 0;
    @observable
    private _historyTotalCount: number = 0;
    @observable
    private _functionNames: { [name: string]: any } = {};

    private _autoRefreshToken: NodeJS.Timeout;
    private _noMorePagesToLoad: boolean = false;
    private readonly _pageSize = 200;
}
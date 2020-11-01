import { observable, computed } from 'mobx';
import mermaid from 'mermaid';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';

export enum DetailsTabEnum {
    Details = 0,
    SequenceDiagram
}

// State of OrchestrationDetails view
export class OrchestrationDetailsState extends ErrorMessageState {

    // Tab currently selected
    @computed
    get selectedTab(): DetailsTabEnum { return this._selectedTab; }
    set selectedTab(val: DetailsTabEnum) {
        this._selectedTab = val;

        if (!this._sequenceDiagramSvg && val === DetailsTabEnum.SequenceDiagram) {
            this.loadSequenceDiagram();
        }
    }

    @computed
    get sequenceDiagramCode(): string { return this._sequenceDiagramCode; };

    @computed
    get sequenceDiagramSvg(): string { return this._sequenceDiagramSvg; };

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
        this._sequenceDiagramSvg = '';

        this.internalLoadDetails(this._orchestrationId).then(response => {
        
            this.details = response;

            // Doing auto-refresh
            if (!!this._autoRefresh) {

                if (!!this._autoRefreshToken) {
                    clearTimeout(this._autoRefreshToken);
                }
                this._autoRefreshToken = setTimeout(() => this.loadDetails(), this._autoRefresh * 1000);
            }

            this._inProgress = false;

            // Reloading the sequence diagram as well
            if (this._selectedTab === DetailsTabEnum.SequenceDiagram) {
                this.loadSequenceDiagram();
            }
            
        }, err => {
            this._inProgress = false;

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    @observable
    private _selectedTab: DetailsTabEnum = DetailsTabEnum.Details;
    @observable
    private _sequenceDiagramCode: string;
    @observable
    private _sequenceDiagramSvg: string;
    @observable
    private _inProgress: boolean = false;
    @observable
    _raiseEventDialogOpen: boolean = false;
    @observable
    _setCustomStatusDialogOpen: boolean = false;
    @observable
    private _autoRefresh: number = 0;

    private _autoRefreshToken: NodeJS.Timeout;
    private _mermaidInitialized = false;

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

    private loadSequenceDiagram() {

        if (!!this.inProgress) {
            return;
        }
        this._inProgress = true;

        if (!this._mermaidInitialized) {
            mermaid.initialize({ startOnLoad: true });
            this._mermaidInitialized = true;
        }

        Promise.all(this.getSequenceForOrchestration(this.details.name, '.', this.details.historyEvents))
            .then(sequenceLines => {

                const sequence = 'sequenceDiagram \n' + sequenceLines.join('');

                try {
                    
                    mermaid.render('mermaidSvgId', sequence, (svg) => {
                        this._sequenceDiagramCode = sequence;
                        this._sequenceDiagramSvg = svg;
                    });

                } catch (err) {
                    this.errorMessage = `Failed to render diagram: ${err.message}`;
                }

                this._inProgress = false;
            }, err => {

                this._inProgress = false;

                // Cancelling auto-refresh just in case
                this._autoRefresh = 0;

                this.errorMessage = `Diagram creation failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
            });
    }

    private getSequenceForOrchestration(orchestrationName: string,
        parentOrchestrationName: string,
        historyEvents: HistoryEvent[]): Promise<string>[] {

        const externalActor = '.'

        const results: Promise<string>[] = [];

        for (var event of historyEvents) {

            switch (event.EventType) {
                case 'ExecutionStarted':

                    var nextLine = `${parentOrchestrationName}->>+${orchestrationName}:[ExecutionStarted] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'SubOrchestrationInstanceCompleted':

                    if (!!event.SubOrchestrationId) {

                        const subOrchestrationName = event.FunctionName;

                        results.push(new Promise<string>((resolve, reject) => {
                            this.internalLoadDetails(event.SubOrchestrationId).then(details => {

                                Promise.all(this.getSequenceForOrchestration(details.name, orchestrationName, details.historyEvents)).then(sequenceLines => {

                                    resolve(sequenceLines.join(''));

                                }, reject);

                            }, err => {
                                    
                                console.log(`Failed to load ${subOrchestrationName}. ${err.message}`);
                                resolve(`${orchestrationName}-x${subOrchestrationName}:[FailedToLoad] \n`);
                            });
                        }));
                    }

                    break;
                case 'SubOrchestrationInstanceFailed':

                    var nextLine = `${orchestrationName}-x${event.FunctionName}:[SubOrchestrationInstanceFailed] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TaskCompleted':

                    var nextLine = `${orchestrationName}->>${orchestrationName}:${event.FunctionName} \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TaskFailed':

                    var nextLine = `${orchestrationName}-x${orchestrationName}:${event.FunctionName}(failed) \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'EventRaised':

                    var nextLine = `${externalActor}->>${orchestrationName}:${event.Name} \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TimerFired':

                    var nextLine = `${externalActor}->>${orchestrationName}:[TimerFired] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'ExecutionCompleted':

                    var nextLine = `${orchestrationName}-->>-${parentOrchestrationName}:[ExecutionCompleted] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
            }
        }

        return results;
    }
}
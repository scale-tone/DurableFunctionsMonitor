import { observable, computed } from 'mobx'

import { IBackendClient } from '../../services/IBackendClient';
import { ErrorMessageState } from '../ErrorMessageState';

// State of New Orchestration Instance Dialog
export class StartNewInstanceDialogState extends ErrorMessageState {

    @observable
    instanceId: string;
    @observable
    orchestratorFunctionName: string;
    @observable
    input: string;

    @computed
    get startedInstanceId(): string { return this._startedInstanceId; }

    @computed
    get inProgress(): boolean { return this._inProgress; }

    @computed
    get dialogOpen(): boolean { return this._dialogOpen; };
    set dialogOpen(value: boolean) {
        this._dialogOpen = value;

        this.instanceId = '';
        this.orchestratorFunctionName = '';
        this.input = '';
        this._startedInstanceId = '';
    }

    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(private _backendClient: IBackendClient) {
        super();
    }
    
    startNewInstance() {

        var inputObject = null;
        if (!!this.input) {
            try {

                inputObject = JSON.parse(this.input);
            
            } catch (err) {
    
                this.errorMessage = `Failed to parse input: ${err.message}`;
                return;
            }
        }

        this._inProgress = true;

        this._backendClient.call('POST', '/orchestrations', { id: this.instanceId, name: this.orchestratorFunctionName, data: inputObject })
        .then(response => {

            this._startedInstanceId = response.instanceId;

        }, err => {
            this.errorMessage = `Failed to start new instance: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    @observable
    private _dialogOpen: boolean = false;

    @observable
    private _inProgress: boolean = false;

    @observable
    private _startedInstanceId: string;
}
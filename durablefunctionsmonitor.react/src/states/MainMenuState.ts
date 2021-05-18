import { observable, computed } from 'mobx'

import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { PurgeHistoryDialogState } from './PurgeHistoryDialogState';
import { CleanEntityStorageDialogState } from './CleanEntityStorageDialogState';

// State of Main Menu component
export class MainMenuState extends ErrorMessageState {

    @observable
    menuAnchorElement?: Element;

    @observable
    hubName: string;
    @observable
    connectionString: string;
    
    @observable
    connectionParamsDialogOpen: boolean = false;

    @computed
    get inProgress(): boolean { return this._inProgress; }

    @computed
    get isReadonly(): boolean { return this._isReadOnly; }

    @computed
    get isDirty(): boolean {
        return (this.connectionString !== this._oldConnectionString) || (this.hubName !== this._oldHubName);
    }

    constructor(private _backendClient: IBackendClient,
        private _purgeHistoryDialogState: PurgeHistoryDialogState,
        private _cleanEntityStorageDialogState: CleanEntityStorageDialogState) {
        super();
    }
    
    showConnectionParamsDialog() {
        this.menuAnchorElement = undefined;

        this.connectionParamsDialogOpen = true;
        this._inProgress = true;

        this._backendClient.call('GET', '/manage-connection').then(response => {

            this.connectionString = this._oldConnectionString = response.connectionString;
            this.hubName = this._oldHubName = response.hubName;
            this._isReadOnly = response.isReadOnly;

        }, err => {
            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    saveConnectionParams() {

        this._inProgress = true;

        this._backendClient.call('PUT', '/manage-connection', {
            connectionString: this.connectionString !== this._oldConnectionString ? this.connectionString : '',
            hubName: this.hubName
        }).then(() => {
        
            this.connectionParamsDialogOpen = false;

            alert(`Your changes were saved to local.settings.json file, but they cannot be picked up automatically. Please, restart the Function Host for them to take effect.`);

        }, err => {
            this.errorMessage = `Save failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    showPurgeHistoryDialog() {
        this.menuAnchorElement = undefined;
        
        this._purgeHistoryDialogState.dialogOpen = true;
    }

    showCleanEntityStorageDialog() {
        this.menuAnchorElement = undefined;

        this._cleanEntityStorageDialogState.dialogOpen = true;
    }

    setWindowTitle() {
        
        this._backendClient.call('GET', '/about').then(response => {
            document.title = `Durable Functions Monitor (${response.accountName}/${response.hubName}) v${response.version}`;
        });
    }

    @observable
    private _inProgress: boolean = false;

    @observable
    private _isReadOnly: boolean = false;

    private _oldConnectionString: string;
    private _oldHubName: string;
}
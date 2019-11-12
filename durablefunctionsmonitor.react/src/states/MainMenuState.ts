import { observable, computed } from 'mobx'

import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { PurgeHistoryDialogState } from './PurgeHistoryDialogState';

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
    get inProgress(): boolean { return this._inProgress; };

    @computed
    get isConnectionStringReadonly(): boolean { return !this._oldConnectionString };

    constructor(private _backendClient: IBackendClient, private _purgeHistoryDialogState: PurgeHistoryDialogState) {
        super();
    }
    
    showConnectionParamsDialog() {
        this.menuAnchorElement = undefined;

        this.connectionParamsDialogOpen = true;
        this._inProgress = true;

        this._backendClient.call('GET', '/manage-connection').then(response => {

            this.connectionString = response.connectionString;
            this._oldConnectionString = this.connectionString;
            this.hubName = response.hubName;

        }, err => {
            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        });
    }

    saveConnectionParams() {

        this._inProgress = true;

        this._backendClient.call('PUT', '/manage-connection', { connectionString: this.connectionString, hubName: this.hubName }).then(() => {
        
            this.connectionParamsDialogOpen = false;

            if (this._oldConnectionString !== this.connectionString) {
                // Didn't find a way to automatically pick up the new Connection String, so just asking user to restart the app
                alert(`You've changed the Connection String, and the new value cannot currently be picked up automatically. Please, restart the Function Host.`);
            } else {
                // Refreshing the window
                location.reload();
            }

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

    @observable
    private _inProgress: boolean = false;

    @observable
    private _oldConnectionString: string;
}
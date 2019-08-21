import { observable, computed } from 'mobx'
import axios from 'axios';

import { ErrorMessageState } from './ErrorMessageState';

export const BackendBaseUri = process.env.REACT_APP_BACKEND_BASE_URI as string;

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
    
    showConnectionParamsDialog() {
        this.menuAnchorElement = undefined;

        this.connectionParamsDialogOpen = true;
        const uri = `${BackendBaseUri}/manage-connection`;
        this._inProgress = true;

        axios.get(uri).then(response => {

            this.connectionString = response.data.connectionString;
            this._oldConnectionString = this.connectionString;
            this.hubName = response.data.hubName;

        }, err => {
            this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        }).finally(() => {
            this._inProgress = false;
        })
    }

    saveConnectionParams() {

        const uri = `${BackendBaseUri}/manage-connection`;
        this._inProgress = true;

        axios.put(uri, {connectionString: this.connectionString, hubName: this.hubName}).then(() => {

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
        })
    }

    @observable
    private _inProgress: boolean = false;

    @observable
    private _oldConnectionString: string;
}
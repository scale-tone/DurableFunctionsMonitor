import { observable } from 'mobx'

import { IBackendClient } from '../services/IBackendClient';
import { PurgeHistoryDialogState } from './dialogs/PurgeHistoryDialogState';
import { CleanEntityStorageDialogState } from './dialogs/CleanEntityStorageDialogState';
import { ConnectionParamsDialogState } from './dialogs/ConnectionParamsDialogState';

// State of Main Menu component
export class MainMenuState {

    @observable
    menuAnchorElement?: Element;

    constructor(private _backendClient: IBackendClient,
        private _purgeHistoryDialogState: PurgeHistoryDialogState,
        private _cleanEntityStorageDialogState: CleanEntityStorageDialogState,
        private _connectionParamsDialogState: ConnectionParamsDialogState) {
    }
    
    showConnectionParamsDialog() {
        this.menuAnchorElement = undefined;

        this._connectionParamsDialogState.dialogOpen = true;
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
}
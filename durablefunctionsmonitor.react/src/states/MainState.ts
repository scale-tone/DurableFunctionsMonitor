import { observable, computed } from 'mobx';

import { IBackendClient } from '../services/IBackendClient';
import { BackendClient } from '../services/BackendClient';
import { LoginState, OrchestrationsPathPrefix } from './LoginState';
import { MainMenuState } from './MainMenuState';
import { OrchestrationsState } from './OrchestrationsState';
import { OrchestrationDetailsState } from './OrchestrationDetailsState';
import { PurgeHistoryDialogState } from './PurgeHistoryDialogState';
import { CleanEntityStorageDialogState } from './CleanEntityStorageDialogState';
import { TypedLocalStorage } from './TypedLocalStorage';
import { VsCodeBackendClient } from '../services/VsCodeBackendClient';
import { VsCodeTypedLocalStorage } from './VsCodeTypedLocalStorage';

// This method is provided by VsCode, when running inside a WebView
declare const acquireVsCodeApi: () => any;

// A global variable declared in index.html and replaced by VsCode extension
declare const OrchestrationIdFromVsCode: string;

// Main Application State
export class MainState  {
    
    loginState?: LoginState;    
    mainMenuState?: MainMenuState;
    orchestrationsState?: OrchestrationsState;
    orchestrationDetailsState?: OrchestrationDetailsState;
    purgeHistoryDialogState: PurgeHistoryDialogState;
    cleanEntityStorageDialogState: CleanEntityStorageDialogState;

    @computed
    get typedInstanceId(): string {
        return this._typedInstanceId;
    }
    set typedInstanceId(s: string) {
        this._typedInstanceId = s;
        this.reloadSuggestions();
    }

    @computed
    get suggestions(): string[] {
        return this._suggestions;
    }

    @computed
    get isExactMatch(): boolean {
        return this._suggestions.length === 1 && this._suggestions[0] === this._typedInstanceId;
    }
    
    constructor() {

        // checking whether we're inside VsCode
        var vsCodeApi: any = undefined;
        try {
            vsCodeApi = acquireVsCodeApi();
        } catch { }

        if (!!vsCodeApi) {

            const backendClient = new VsCodeBackendClient(vsCodeApi);
            this._backendClient = backendClient;

            this.purgeHistoryDialogState = new PurgeHistoryDialogState(backendClient);
            this.cleanEntityStorageDialogState = new CleanEntityStorageDialogState(backendClient);

            if (!!this.orchestrationId) {
                this.orchestrationDetailsState = new OrchestrationDetailsState(this.orchestrationId,
                    backendClient,
                    new VsCodeTypedLocalStorage<OrchestrationDetailsState>('OrchestrationDetailsState', vsCodeApi));
            } else {
                this.orchestrationsState = new OrchestrationsState(backendClient,
                    new VsCodeTypedLocalStorage<OrchestrationsState>('OrchestrationsState', vsCodeApi));

                backendClient.setCustomHandlers(
                    () => this.purgeHistoryDialogState.dialogOpen = true,
                    () => this.cleanEntityStorageDialogState.dialogOpen = true
                );
            }
            
        } else {

            this.loginState = new LoginState();

            const backendClient = new BackendClient(() => this.loginState.taskHubName, () => this.loginState.getAuthorizationHeaderAsync());
            this._backendClient = backendClient;

            this.purgeHistoryDialogState = new PurgeHistoryDialogState(backendClient);
            this.cleanEntityStorageDialogState = new CleanEntityStorageDialogState(backendClient);

            if (!!this.orchestrationId) {
                this.orchestrationDetailsState = new OrchestrationDetailsState(this.orchestrationId,
                    backendClient, 
                    new TypedLocalStorage<OrchestrationDetailsState>('OrchestrationDetailsState'));
            } else {
                this.mainMenuState = new MainMenuState(backendClient, this.purgeHistoryDialogState, this.cleanEntityStorageDialogState);
                this.orchestrationsState = new OrchestrationsState(backendClient,
                    new TypedLocalStorage<OrchestrationsState>('OrchestrationsState'));
            }
        }
    }

    // Opens the entered orchestrationId in a new tab
    goto() {
        window.open(`${this._backendClient.routePrefixAndTaskHubName}${OrchestrationsPathPrefix}${this._typedInstanceId}`);
        this._typedInstanceId = '';
        this._suggestions = [];
    }

    @observable
    private _suggestions: string[] = [];
    @observable
    private _typedInstanceId: string = '';

    private readonly _backendClient: IBackendClient;

    // Extracts orchestrationId from URL or from VsCode
    private get orchestrationId(): string {

        if (!!OrchestrationIdFromVsCode) {
            return OrchestrationIdFromVsCode;
        }

        const pos = window.location.pathname.lastIndexOf(OrchestrationsPathPrefix);
        if (pos < 0) {
            return '';
        }

        return window.location.pathname.substr(pos + OrchestrationsPathPrefix.length);
    }

    // Reloads list of suggested instanceIds
    private reloadSuggestions(): void {

        if (!this._typedInstanceId || this._typedInstanceId.length < 2) {
            this._suggestions = [];
            return;
        }

        const uri = `/id-suggestions(prefix='${this._typedInstanceId}')`;
        this._backendClient.call('GET', uri).then(response => {

            if (!response || !this._typedInstanceId) {
                this._suggestions = [];
            } else {
                this._suggestions = response;
            }
        });
    }
}
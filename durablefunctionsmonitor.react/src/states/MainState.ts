import { BackendClient } from '../services/BackendClient';
import { LoginState } from './LoginState';
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

    constructor() {

        // checking whether we're inside VsCode
        var vsCodeApi: any = undefined;
        try {
            vsCodeApi = acquireVsCodeApi();
        } catch { }

        if (!!vsCodeApi) {

            const backendClient = new VsCodeBackendClient(vsCodeApi);

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

            const backendClient = new BackendClient(this.loginState.getAuthorizationHeaderAsync);

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

    // Extracts orchestrationId from URL or from VsCode
    private get orchestrationId(): string {

        if (!!OrchestrationIdFromVsCode) {
            return OrchestrationIdFromVsCode;
        }

        const uriSuffix = `/orchestrations/`;
        if (!window.location.pathname.startsWith(uriSuffix)) {
            return '';
        }

        return window.location.pathname.substr(uriSuffix.length);
    }
}
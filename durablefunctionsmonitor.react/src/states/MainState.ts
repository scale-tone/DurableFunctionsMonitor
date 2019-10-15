import { LoginState } from './LoginState';
import { MainMenuState } from './MainMenuState';
import { OrchestrationsState } from './OrchestrationsState';
import { OrchestrationDetailsState } from './OrchestrationDetailsState';

import { BackendClient } from '../services/BackendClient';
import { VsCodeBackendClient } from '../services/VsCodeBackendClient';

// This method is provided by VsCode, when running inside a WebView
declare const acquireVsCodeApi: () => any;

// A global variable declared in index.html and replaced by VsCode extension
declare const OrchestrationIdFromVsCode: string;

export const UriSuffix = process.env.REACT_APP_URI_SUFFIX as string;

// Main Application State
export class MainState {
    
    loginState?: LoginState;    
    mainMenuState?: MainMenuState;
    orchestrationsState?: OrchestrationsState;
    orchestrationDetailsState?: OrchestrationDetailsState;

    constructor() {

        // checking whether we're inside VsCode
        var vsCodeApi: any = undefined;
        try {
            vsCodeApi = acquireVsCodeApi();
        } catch { }

        if (!!vsCodeApi) {

            const backendClient = new VsCodeBackendClient(vsCodeApi);

            if (!!this.orchestrationId) {
                this.orchestrationDetailsState = new OrchestrationDetailsState(this.orchestrationId, backendClient);
            } else {
                this.orchestrationsState = new OrchestrationsState(backendClient);
            }
            
        } else {

            this.loginState = new LoginState();

            const backendClient = new BackendClient(this.loginState.getAuthorizationHeaderAsync);

            if (!!this.orchestrationId) {
                this.orchestrationDetailsState = new OrchestrationDetailsState(this.orchestrationId, backendClient);
            } else {
                this.mainMenuState = new MainMenuState(backendClient);
                this.orchestrationsState = new OrchestrationsState(backendClient);
            }
        }
    }

    // Extracts orchestrationId from URL or from VsCode
    private get orchestrationId(): string {

        if (!!OrchestrationIdFromVsCode) {
            return OrchestrationIdFromVsCode;
        }

        const uriSuffix = `${UriSuffix}/orchestrations/`;
        if (!window.location.pathname.startsWith(uriSuffix)) {
            return '';
        }

        return window.location.pathname.substr(uriSuffix.length);
    }
}
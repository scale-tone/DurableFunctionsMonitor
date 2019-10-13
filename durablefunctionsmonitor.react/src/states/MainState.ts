import { LoginState } from './LoginState';
import { MainMenuState } from './MainMenuState';
import { OrchestrationsState } from './OrchestrationsState';
import { OrchestrationDetailsState } from './OrchestrationDetailsState';

import { BackendClient } from '../services/BackendClient';

// Main Application State
export class MainState {
    
    loginState: LoginState = new LoginState();
    mainMenuState: MainMenuState = new MainMenuState(new BackendClient(this.loginState.getAuthorizationHeaderAsync));
    orchestrationsState: OrchestrationsState = new OrchestrationsState(new BackendClient(this.loginState.getAuthorizationHeaderAsync));
    orchestrationDetailsState: OrchestrationDetailsState = new OrchestrationDetailsState(new BackendClient(this.loginState.getAuthorizationHeaderAsync));
}
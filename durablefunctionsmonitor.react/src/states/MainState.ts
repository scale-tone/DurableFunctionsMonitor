import { LoginState } from './LoginState';
import { MainMenuState } from './MainMenuState';
import { OrchestrationsState } from './OrchestrationsState';
import { OrchestrationDetailsState } from './OrchestrationDetailsState';

export const BackendBaseUri = process.env.REACT_APP_BACKEND_BASE_URI as string;

// Main Application State
export class MainState {
    
    loginState: LoginState = new LoginState();
    mainMenuState: MainMenuState = new MainMenuState(this.loginState.getAuthorizationHeaderAsync);
    orchestrationsState: OrchestrationsState = new OrchestrationsState(this.loginState.getAuthorizationHeaderAsync);
    orchestrationDetailsState: OrchestrationDetailsState = new OrchestrationDetailsState(this.loginState.getAuthorizationHeaderAsync);
}
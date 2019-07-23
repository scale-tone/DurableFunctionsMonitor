import { MainMenuState } from './MainMenuState';
import { OrchestrationsState } from './OrchestrationsState';
import { OrchestrationDetailsState } from './OrchestrationDetailsState';

// Main Application State
export class MainState {
    mainMenuState: MainMenuState = new MainMenuState();
    orchestrationsState: OrchestrationsState = new OrchestrationsState();
    orchestrationDetailsState: OrchestrationDetailsState = new OrchestrationDetailsState();
}
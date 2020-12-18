
import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';

// Represents states of custom tabs
export interface ICustomTabState {

    name: string;
    description: string;
    rawHtml: string;
    isMermaidDiagram: boolean;

    load(details: DurableOrchestrationStatus): Promise<void>;
}

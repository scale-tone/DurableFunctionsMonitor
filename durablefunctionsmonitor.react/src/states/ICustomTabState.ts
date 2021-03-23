import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { CancelToken } from '../CancelToken';

// Represents states of custom tabs
export interface ICustomTabState {

    name: string;
    description: string;
    rawHtml: string;
    isMermaidDiagram: boolean;

    load(details: DurableOrchestrationStatus, cancelToken: CancelToken): Promise<void>;
}

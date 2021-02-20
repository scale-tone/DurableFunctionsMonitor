import { observable, computed } from 'mobx'
import mermaid from 'mermaid';

import { DurableOrchestrationStatus, EntityType } from './DurableOrchestrationStatus';
import { IBackendClient } from '../services/IBackendClient';
import { CancelToken } from '../CancelToken';
import { formatDuration, formatDateTime, formatDurationInSeconds } from './MermaidDiagramTabState';
import { IResultsTabState } from './ListResultsTabState';

// Resulting list of orchestrations represented as a Gantt chart
export class HistogramResultsTabState implements IResultsTabState {

    constructor(private _backendClient: IBackendClient) {
        
    }

    reset() {

    }

    load(filterClause: string, cancelToken: CancelToken, isAutoRefresh: boolean): Promise<void>{

        return Promise.resolve();
    }
}


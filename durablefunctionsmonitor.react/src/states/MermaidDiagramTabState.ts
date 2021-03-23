import { computed } from 'mobx';

import { ICustomTabState } from './ICustomTabState';
import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';
import { CancelToken } from '../CancelToken';

// Base class for all mermaid diagram tab states
export abstract class MermaidDiagramTabState extends MermaidDiagramStateBase implements ICustomTabState {

    readonly name: string = "Diagram";
    readonly isMermaidDiagram: boolean = true;

    @computed
    get description(): string { return this._diagramCode; };

    @computed
    get rawHtml(): string { return this._diagramSvg; };

    constructor(protected _loadHistory: (orchestrationId: string) => Promise<HistoryEvent[]>) {
        super();
    }

    load(details: DurableOrchestrationStatus, cancelToken: CancelToken): Promise<void> {
        
        // Only doing this on demand, just in case
        this.initMermaidWhenNeeded();

        return this._loadHistory(details.instanceId).then(history => {

            if (!history.length || cancelToken.isCancelled) {
                return;
            }

            return this.buildDiagram(details, history, cancelToken);
        });
    }

    protected abstract buildDiagram(details: DurableOrchestrationStatus, history: HistoryEvent[], cancelToken: CancelToken): Promise<void>;
}
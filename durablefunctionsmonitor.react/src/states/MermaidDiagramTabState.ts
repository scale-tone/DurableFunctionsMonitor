import { computed } from 'mobx';

import { ICustomTabState } from './ICustomTabState';
import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';

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

    load(details: DurableOrchestrationStatus): Promise<void> {
        
        // Only doing this on demand, just in case
        this.initMermaidWhenNeeded();

        return this._loadHistory(details.instanceId)
            .then(history => !history.length ? Promise.resolve() : this.buildDiagram(details, history));
    }

    protected abstract buildDiagram(details: DurableOrchestrationStatus, history: HistoryEvent[]): Promise<void>;
}
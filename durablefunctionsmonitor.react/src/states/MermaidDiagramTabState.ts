import { observable, computed } from 'mobx';

import { ICustomTabState } from './ICustomTabState';
import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';

// Base class for all mermaid diagram tab states
export abstract class MermaidDiagramTabState extends MermaidDiagramStateBase implements ICustomTabState {

    readonly name: string = "Diagram";
    readonly isMermaidDiagram: boolean = true;

    @computed
    get description(): string { return this._diagramCode; };

    @computed
    get rawHtml(): string { return this._diagramSvg; };

    constructor(protected _loadDetails: (orchestrationId: string) => Promise<DurableOrchestrationStatus>) {
        super();
    }

    load(details: DurableOrchestrationStatus): Promise<void> {
        
        // Only doing this on demand, just in case
        this.initMermaidWhenNeeded();

        if (!details.historyEvents) {
            return Promise.resolve();
        }

        return this.buildDiagram(details);
    }

    protected abstract buildDiagram(details: DurableOrchestrationStatus): Promise<void>;
}
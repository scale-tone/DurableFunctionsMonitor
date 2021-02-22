import { observable, computed } from 'mobx'
import mermaid from 'mermaid';

import { DurableOrchestrationStatus } from './DurableOrchestrationStatus';
import { IBackendClient } from '../services/IBackendClient';
import { CancelToken } from '../CancelToken';
import { formatDuration, formatDateTime, formatDurationInSeconds } from './MermaidDiagramTabState';
import { IResultsTabState } from './ResultsListTabState';

// Resulting list of orchestrations represented as a Gantt chart
export class ResultsGanttDiagramTabState implements IResultsTabState {

    @computed
    get rawHtml(): string { return this._diagramSvg; }

    @computed
    get diagramCode(): string { return this._diagramCode; }

    constructor(private _backendClient: IBackendClient) {
    }

    reset() {

        this._diagramCode = '';
        this._diagramSvg = '';
    }

    load(filterClause: string, cancelToken: CancelToken, isAutoRefresh: boolean): Promise<void>{

        return new Promise<void>((resolve, reject) => {

            const hiddenColumnsClause = `&hidden-columns=history|input|output|customStatus|lastEvent`;

            const uri = `/orchestrations?$top=500&$orderby=createdTime asc${hiddenColumnsClause}${filterClause}`;

            this._backendClient.call('GET', uri).then((instances: DurableOrchestrationStatus[]) => {

                var allPromises = this.renderDiagram(instances);

                Promise.all(allPromises).then(sequenceLines => {

                    this._diagramCode = 'gantt \n' +
                        `title Gantt Chart (${instances.length} instances shown) \n` +
                        'dateFormat YYYY-MM-DDTHH:mm:ssZ \n' +
                        sequenceLines.join('');

                    // Very much unknown, why this line is needed. Without it sometimes the diagrams fail to re-render
                    this._diagramSvg = '';

                    try {

                        mermaid.render('mermaidSvgId', this._diagramCode, (svg) => {
                            this._diagramSvg = svg;
                            resolve();
                        });

                    } catch (err) {
                        reject(err);
                    }

                }, reject);

            }, reject);
        });
    }

    @observable
    private _diagramSvg: string = '';
    @observable
    private _diagramCode: string = '';

    private escapeOrchestrationId(id: string) {

        return id.replace(/[@:;]/g, ' ');
    }

    private renderDiagram(instances: DurableOrchestrationStatus[]): Promise<string>[] {

        const results: Promise<string>[] = [];

        var prevSectionName = '';
        var sectionNr = 0;
        for (const instance of instances) {

            var nextLine = '';

            // Grouping instances by their type
            const sectionName = instance.entityType === 'DurableEntity' ? instance.entityId.name : instance.name;
            if (sectionName != prevSectionName) {
                
                nextLine = `section ${++sectionNr}. ${this.escapeOrchestrationId(sectionName)} \n`;
                prevSectionName = sectionName;
            }

            const instanceId = instance.entityType === 'DurableEntity' ? instance.entityId.key : instance.instanceId;

            const durationInMs = new Date(instance.lastUpdatedTime).getTime() - new Date(instance.createdTime).getTime();

            nextLine += `${this.escapeOrchestrationId(instanceId)} ${formatDuration(durationInMs)}: active, ${formatDateTime(instance.createdTime)}, ${formatDurationInSeconds(durationInMs < 1000 ? 1000 : durationInMs)} \n`;
            
            results.push(Promise.resolve(nextLine));
        }

        return results;
    }
}
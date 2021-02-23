import mermaid from 'mermaid';

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramTabState, formatDuration, formatDateTime, formatDurationInSeconds } from './MermaidDiagramTabState';

// State of Gantt Diagram tab on OrchestrationDetails view
export class GanttDiagramTabState extends MermaidDiagramTabState {

    readonly name: string = "Gantt Chart";

    protected buildDiagram(details: DurableOrchestrationStatus): Promise<void> {

        return new Promise<void>((resolve, reject) => {
            Promise.all(this.renderOrchestration(details, true)).then(sequenceLines => {

                this._diagramCode = 'gantt \n' +
                    `title ${details.name}(${details.instanceId}) \n` +
                    'dateFormat YYYY-MM-DDTHH:mm:ss.SSS \n' +
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
        });
    }

    private renderOrchestration(details: DurableOrchestrationStatus, isParentOrchestration: boolean): Promise<string>[] {

        const results: Promise<string>[] = [];

        const orchestrationId = details.instanceId;
        const orchestrationName = details.name;
        const historyEvents = details.historyEvents;

        const startedEvent = historyEvents.find(event => event.EventType === 'ExecutionStarted');
        const completedEvent = historyEvents.find(event => event.EventType === 'ExecutionCompleted');

        var needToAddAxisFormat = isParentOrchestration;
        var nextLine: string;

        if (!!startedEvent && !!completedEvent) {

            if (needToAddAxisFormat) {

                const longerThanADay = completedEvent.DurationInMs > 86400000;
                nextLine = longerThanADay ? 'axisFormat %Y-%m-%d %H:%M \n' : 'axisFormat %H:%M:%S \n';
                results.push(Promise.resolve(nextLine));
                needToAddAxisFormat = false;
            }
            
            nextLine = isParentOrchestration ? '' : `section ${orchestrationName}(${this.escapeOrchestrationId(orchestrationId)}) \n`;

            var lineName = formatDuration(completedEvent.DurationInMs);
            if (!lineName) {
                lineName = orchestrationName;
            }

            nextLine += `${lineName}: ${isParentOrchestration ? '' : 'active,'} ${formatDateTime(startedEvent.Timestamp)}, ${formatDurationInSeconds(completedEvent.DurationInMs)} \n`;
            results.push(Promise.resolve(nextLine));
        }

        if (needToAddAxisFormat) {

            nextLine = 'axisFormat %H:%M:%S \n';
            results.push(Promise.resolve(nextLine));
        }

        for(var event of historyEvents) {
        
            switch (event.EventType) {
                case 'SubOrchestrationInstanceCompleted':

                    if (!!event.SubOrchestrationId) {

                        const subOrchestrationName = event.FunctionName;

                        results.push(new Promise<string>((resolve, reject) => {
                            this._loadDetails(event.SubOrchestrationId).then(details => {

                                Promise.all(this.renderOrchestration(details, false)).then(sequenceLines => {

                                    resolve(sequenceLines.join(''));

                                }, reject);

                            }, err => {

                                console.log(`Failed to load ${subOrchestrationName}. ${err.message}`);
                                resolve(`%% Failed to load ${subOrchestrationName}. ${err.message} \n`);
                            });
                        }));
                    }

                    break;
                case 'TaskCompleted':

                    nextLine = `${event.FunctionName} ${formatDuration(event.DurationInMs)}: done, ${formatDateTime(event.ScheduledTime)}, ${formatDurationInSeconds(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'TaskFailed':

                    nextLine = `${event.FunctionName} ${formatDuration(event.DurationInMs)}: crit, ${formatDateTime(event.ScheduledTime)}, ${formatDurationInSeconds(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
            }
        }

        return results;
    }

    private escapeOrchestrationId(id: string) {

        return id.replace(/[:;]/g, ' ');
    }
}
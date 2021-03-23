import mermaid from 'mermaid';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramTabState } from './MermaidDiagramTabState';

// State of Sequence Diagram tab on OrchestrationDetails view
export class SequenceDiagramTabState extends MermaidDiagramTabState {

    readonly name: string = "Sequence Diagram";

    protected buildDiagram(details: DurableOrchestrationStatus, history: HistoryEvent[]) : Promise<void> {

        return new Promise<void>((resolve, reject) => {
            Promise.all(this.getSequenceForOrchestration(details.name, '.', history)).then(sequenceLines => {

                this._diagramCode = 'sequenceDiagram \n' + sequenceLines.join('');

                try {

                    // Very much unknown, why this line is needed. Without it sometimes the diagrams fail to re-render
                    this._diagramSvg = '';

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

    private getSequenceForOrchestration(orchestrationName: string, parentOrchestrationName: string, historyEvents: HistoryEvent[]): Promise<string>[] {

        const externalActor = '.'
        const results: Promise<string>[] = [];
        var nextLine: string;

        var i = 0;
        while (i < historyEvents.length) {
            const event = historyEvents[i];

            switch (event.EventType) {
                case 'ExecutionStarted':

                    nextLine =
                        `${parentOrchestrationName}->>+${orchestrationName}:[ExecutionStarted] \n` +
                        `Note over ${parentOrchestrationName},${orchestrationName}: ${this.formatTimestamp(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'SubOrchestrationInstanceCompleted':

                    if (!!event.SubOrchestrationId) {

                        const subOrchestrationId = event.SubOrchestrationId;
                        const subOrchestrationName = event.FunctionName;

                        results.push(new Promise<string>((resolve, reject) => {
                            this._loadHistory(subOrchestrationId).then(history => {

                                Promise.all(this.getSequenceForOrchestration(subOrchestrationName, orchestrationName, history)).then(sequenceLines => {

                                    resolve(sequenceLines.join(''));

                                }, reject);

                            }, err => {

                                console.log(`Failed to load ${subOrchestrationName}. ${err.message}`);
                                resolve(`${orchestrationName}-x${subOrchestrationName}:[FailedToLoad] \n`);
                            });
                        }));
                    }

                    break;
                case 'SubOrchestrationInstanceFailed':

                    nextLine = `${orchestrationName}-x${event.FunctionName}:[SubOrchestrationInstanceFailed] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TaskCompleted':

                    // Trying to aggregate multiple parallel calls
                    var maxDurationInMs = event.DurationInMs;
                    var j = i + 1;
                    for (; j < historyEvents.length &&
                        historyEvents[j].EventType === 'TaskCompleted' &&
                        historyEvents[j].FunctionName === event.FunctionName &&
                        historyEvents[j].ScheduledTime.substr(0, 23) === event.ScheduledTime.substr(0, 23);
                        j++) {

                        if (maxDurationInMs < historyEvents[j].DurationInMs) {
                            maxDurationInMs = historyEvents[j].DurationInMs;
                        }
                    }

                    if (j === i + 1) {

                        const nextLine =
                            `${orchestrationName}->>${orchestrationName}:${event.FunctionName} \n` +
                            `Note over ${orchestrationName}: ${this.formatDuration(event.DurationInMs)} \n`;
                        results.push(Promise.resolve(nextLine));
                        
                    } else {

                        const nextLine =
                            `par ${j - i} calls \n` +
                            `${orchestrationName}->>${orchestrationName}:${event.FunctionName} \n` +
                            `Note over ${orchestrationName}: ${this.formatDuration(maxDurationInMs)} \n` +
                            `end \n`;
                        results.push(Promise.resolve(nextLine));

                        i = j - 1;
                    }

                    break;
                case 'TaskFailed':

                    nextLine = `${orchestrationName}-x${orchestrationName}:${event.FunctionName}(failed) \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'EventRaised':

                    nextLine =
                        `${externalActor}->>${orchestrationName}:${event.Name} \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatTimestamp(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'TimerFired':

                    nextLine =
                        `${externalActor}->>${orchestrationName}:[TimerFired] \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatTimestamp(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'ExecutionTerminated':

                    nextLine =
                        `${externalActor}->>${orchestrationName}:[ExecutionTerminated] \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatTimestamp(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'ExecutionCompleted':

                    nextLine =
                        `${orchestrationName}-->>-${parentOrchestrationName}:[ExecutionCompleted] \n` +
                        `Note over ${orchestrationName},${parentOrchestrationName}: ${this.formatDuration(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
            }

            i++;
        }

        return results;
    }

    private formatTimestamp(timestamp: string): string {
        if (timestamp.length <= 11) {
            return timestamp;
        }
        return '(' + timestamp.substr(11, 12) + 'Z)';
    }
}
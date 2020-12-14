import { observable, computed } from 'mobx';
import mermaid from 'mermaid';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { ICustomTabState } from './OrchestrationDetailsState';

// State of Sequence Diagram tab on OrchestrationDetails view
export class SequenceDiagramTabState implements ICustomTabState {

    readonly name: string = "Sequence Diagram";

    @computed
    get description(): string { return this._sequenceDiagramCode; };

    @computed
    get rawHtml(): string { return this._sequenceDiagramSvg; };

    constructor(private _loadDetails: (orchestrationId: string) => Promise<DurableOrchestrationStatus>) {
    }

    load(details: DurableOrchestrationStatus) : Promise<void> {

        if (!this._mermaidInitialized) {

            mermaid.initialize({
                startOnLoad: true,
                sequence: {
                    noteMargin: 0,
                    boxMargin: 5,
                    boxTextMargin: 5
                }
            });
            this._mermaidInitialized = true;
        }

        if (!details.historyEvents) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {
            Promise.all(this.getSequenceForOrchestration(details.name, '.', details.historyEvents)).then(sequenceLines => {

                const sequenceCode = 'sequenceDiagram \n' + sequenceLines.join('');

                try {

                    mermaid.render('mermaidSvgId', sequenceCode, (svg) => {
                        this._sequenceDiagramCode = sequenceCode;
                        this._sequenceDiagramSvg = svg;
                        resolve();
                    });
                    
                } catch (err) {
                    reject(err);
                }

            }, reject);
        });
    }

    @observable
    private _sequenceDiagramCode: string;
    @observable
    private _sequenceDiagramSvg: string;
    private _mermaidInitialized = false;

    private getSequenceForOrchestration(orchestrationName: string,
        parentOrchestrationName: string,
        historyEvents: HistoryEvent[]): Promise<string>[] {

        const externalActor = '.'
        const results: Promise<string>[] = [];

        var i = 0;
        while (i < historyEvents.length) {
            const event = historyEvents[i];

            switch (event.EventType) {
                case 'ExecutionStarted':

                    var nextLine =
                        `${parentOrchestrationName}->>+${orchestrationName}:[ExecutionStarted] \n` +
                        `Note over ${parentOrchestrationName},${orchestrationName}: ${this.formatDateTime(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'SubOrchestrationInstanceCompleted':

                    if (!!event.SubOrchestrationId) {

                        const subOrchestrationName = event.FunctionName;

                        results.push(new Promise<string>((resolve, reject) => {
                            this._loadDetails(event.SubOrchestrationId).then(details => {

                                Promise.all(this.getSequenceForOrchestration(details.name, orchestrationName, details.historyEvents)).then(sequenceLines => {

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

                    var nextLine = `${orchestrationName}-x${event.FunctionName}:[SubOrchestrationInstanceFailed] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TaskCompleted':

                    // Trying to aggregate multiple parallel calls
                    var maxDurationInMs = event.DurationInMs;
                    var j = i + 1;
                    for (; j < historyEvents.length &&
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

                    var nextLine = `${orchestrationName}-x${orchestrationName}:${event.FunctionName}(failed) \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'EventRaised':

                    var nextLine =
                        `${externalActor}->>${orchestrationName}:${event.Name} \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatDateTime(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'TimerFired':

                    var nextLine =
                        `${externalActor}->>${orchestrationName}:[TimerFired] \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatDateTime(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'ExecutionTerminated':

                    var nextLine =
                        `${externalActor}->>${orchestrationName}:[ExecutionTerminated] \n` +
                        `Note over ${externalActor},${orchestrationName}: ${this.formatDateTime(event.Timestamp)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
                case 'ExecutionCompleted':

                    var nextLine =
                        `${orchestrationName}-->>-${parentOrchestrationName}:[ExecutionCompleted] \n` +
                        `Note over ${orchestrationName},${parentOrchestrationName}: ${this.formatDuration(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));

                    break;
            }

            i++;
        }

        return results;
    }

    private formatDateTime(timestamp: string): string {
        if (timestamp.length <= 11) {
            return timestamp;
        }
        return '(' + timestamp.substr(11, 12) + 'Z)';
    }

    private formatDuration(durationInMs: number): string {

        var result = '';
        if (isNaN(durationInMs) || (durationInMs < 0)) {
            return result;
        }

        const days = Math.floor(durationInMs / 86400000);
        if (days > 30) {
            // something went wrong...
            return result;
        }

        if (days > 0) {
            result += days.toFixed(0) + 'd';
            durationInMs = durationInMs % 86400000;
        }

        const hours = Math.floor(durationInMs / 3600000);
        if (hours > 0) {
            result += hours.toFixed(0) + 'h';
            durationInMs = durationInMs % 3600000;
        }

        const minutes = Math.floor(durationInMs / 60000);
        if (minutes > 0) {
            result += minutes.toFixed(0) + 'm';
            durationInMs = durationInMs % 60000;
        }

        const seconds = Math.floor(durationInMs / 1000);
        if (seconds > 0) {
            result += seconds.toFixed(0) + 's';
            durationInMs = durationInMs % 1000;
        }

        if (durationInMs > 0) {
            result += durationInMs.toFixed(0) + 'ms';
        }

        return '(' + result + ')';
    }
}
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
            mermaid.initialize({ startOnLoad: true });
            this._mermaidInitialized = true;
        }

        if (!!this._sequenceDiagramSvg || !details.historyEvents) {
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

        for (var event of historyEvents) {

            switch (event.EventType) {
                case 'ExecutionStarted':

                    var nextLine = `${parentOrchestrationName}->>+${orchestrationName}:[ExecutionStarted] \n`;
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

                    var nextLine = `${orchestrationName}->>${orchestrationName}:${event.FunctionName} \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TaskFailed':

                    var nextLine = `${orchestrationName}-x${orchestrationName}:${event.FunctionName}(failed) \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'EventRaised':

                    var nextLine = `${externalActor}->>${orchestrationName}:${event.Name} \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'TimerFired':

                    var nextLine = `${externalActor}->>${orchestrationName}:[TimerFired] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
                case 'ExecutionCompleted':

                    var nextLine = `${orchestrationName}-->>-${parentOrchestrationName}:[ExecutionCompleted] \n`;
                    results.push(Promise.resolve(nextLine));
                    break;
            }
        }

        return results;
    }
}
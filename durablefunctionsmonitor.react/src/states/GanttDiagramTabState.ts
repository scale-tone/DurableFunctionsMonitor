import mermaid from 'mermaid';
import moment from 'moment';

import { DurableOrchestrationStatus, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { MermaidDiagramTabState } from './MermaidDiagramTabState';
import { CancelToken } from '../CancelToken';
import { dfmContextInstance } from '../DfmContext';

// State of Gantt Diagram tab on OrchestrationDetails view
export class GanttDiagramTabState extends MermaidDiagramTabState {

    readonly name: string = "Gantt Chart";

    protected buildDiagram(details: DurableOrchestrationStatus, history: HistoryEvent[], cancelToken: CancelToken): Promise<void> {

        this.orchestrationsToBeCorrected = [];
        this.currentLineNumber = 0;

        return new Promise<void>((resolve, reject) => {
            Promise.all(this.renderOrchestration(details.instanceId, details.name, history, true)).then(sequenceLines => {

                if (cancelToken.isCancelled) {

                    resolve();
                    return;
                }

                this._diagramCode = 'gantt \n' +
                    `title ${details.name}(${details.instanceId}) \n` +
                    'dateFormat YYYY-MM-DDTHH:mm:ss.SSS \n' +
                    sequenceLines.join('');

                // Very much unknown, why this line is needed. Without it sometimes the diagrams fail to re-render
                this._diagramSvg = '';

                try {

                    mermaid.render('mermaidSvgId', this._diagramCode, (svg) => {

                        this._diagramSvg = this.adjustIntervalsSmallerThanOneSecond(svg);

                        resolve();
                    });
                    
                } catch (err) {
                    reject(err);
                }

            }, reject);
        });
    }

    private orchestrationsToBeCorrected: { index: number, durationInMs: number, activities: {index: number, durationInMs: number}[] }[] = [];
    private currentLineNumber: 0;

    // Workaround for mermaid being unable to render intervals shorter than 1 second
    private adjustIntervalsSmallerThanOneSecond(svg: string): string {

        for(var orch of this.orchestrationsToBeCorrected) {

            const match = new RegExp(`<rect id="task${orch.index}" [^>]+ width="([0-9]+)"`, 'i').exec(svg);
            if (!!match) {

                const orchWidth = parseInt(match[1]);

                for(var act of orch.activities) {

                    // The below correction only needs to be applied to activities shorter than 10 seconds
                    if (act.durationInMs < 10000 && orch.durationInMs > 0) {

                        svg = svg.replace(new RegExp(`<rect id="task${act.index}" [^>]+ width="([0-9]+)"`, 'i'), (match, width) => 
                            match.replace(`width="${width}"`, `width="${Math.ceil(orchWidth * (act.durationInMs / orch.durationInMs)).toFixed(0)}"`)
                        );
                    }
                }
            }
        }

        return svg;
    }

    private renderOrchestration(orchestrationId: string, orchestrationName: string, historyEvents: HistoryEvent[], isParentOrchestration: boolean): Promise<string>[] {

        const results: Promise<string>[] = [];

        const startedEvent = historyEvents.find(event => event.EventType === 'ExecutionStarted');
        const completedEvent = historyEvents.find(event => event.EventType === 'ExecutionCompleted');

        var needToAddAxisFormat = isParentOrchestration;
        var nextLine: string;

        var currentLineInfo = { index: 0, durationInMs: 0, activities: [] };

        if (!!startedEvent && !!completedEvent) {

            if (needToAddAxisFormat) {

                const longerThanADay = completedEvent.DurationInMs > 86400000;
                nextLine = longerThanADay ? 'axisFormat %Y-%m-%d %H:%M \n' : 'axisFormat %H:%M:%S \n';
                results.push(Promise.resolve(nextLine));
                needToAddAxisFormat = false;
            }
            
            nextLine = isParentOrchestration ? '' : `section ${orchestrationName}(${this.escapeTitle(orchestrationId)}) \n`;

            var lineName = this.formatDuration(completedEvent.DurationInMs);
            if (!lineName) {
                lineName = orchestrationName;
            }

            nextLine += `${lineName}: ${isParentOrchestration ? '' : 'active,'} ${this.formatDateTime(startedEvent.Timestamp)}, ${this.formatDurationInSeconds(completedEvent.DurationInMs)} \n`;
            results.push(Promise.resolve(nextLine));
            this.currentLineNumber++;

            currentLineInfo.index = this.currentLineNumber;
            currentLineInfo.durationInMs = completedEvent.DurationInMs;
        }

        if (needToAddAxisFormat) {

            nextLine = 'axisFormat %H:%M:%S \n';
            results.push(Promise.resolve(nextLine));
        }

        for(var event of historyEvents) {
        
            switch (event.EventType) {
                case 'SubOrchestrationInstanceCompleted':

                    if (!!event.SubOrchestrationId) {

                        const subOrchestrationId = event.SubOrchestrationId;
                        const subOrchestrationName = event.FunctionName;

                        results.push(new Promise<string>((resolve, reject) => {
                            this._loadHistory(subOrchestrationId).then(history => {

                                Promise.all(this.renderOrchestration(subOrchestrationId, subOrchestrationName, history, false)).then(sequenceLines => {

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

                    nextLine = `${event.FunctionName} ${this.formatDuration(event.DurationInMs)}: done, ${this.formatDateTime(event.ScheduledTime)}, ${this.formatDurationInSeconds(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));
                    this.currentLineNumber++;

                    currentLineInfo.activities.push({ index: this.currentLineNumber, durationInMs: event.DurationInMs });

                    break;
                case 'TaskFailed':

                    nextLine = `${event.FunctionName} ${this.formatDuration(event.DurationInMs)}: crit, ${this.formatDateTime(event.ScheduledTime)}, ${this.formatDurationInSeconds(event.DurationInMs)} \n`;
                    results.push(Promise.resolve(nextLine));
                    this.currentLineNumber++;

                    currentLineInfo.activities.push({ index: this.currentLineNumber, durationInMs: event.DurationInMs });

                    break;
            }
        }

        // Collecting some extra info about orchestrations vs activities, to correct line widths later on
        if (currentLineInfo.index > 0) {
            this.orchestrationsToBeCorrected.push(currentLineInfo);
        }

        return results;
    }

    private formatDateTime(utcDateTimeString: string): string {

        if (!dfmContextInstance.showTimeAsLocal) {
            return utcDateTimeString.substr(0, 23);
        }

        return moment(utcDateTimeString).format('YYYY-MM-DDTHH:mm:ss.SSS')
    }
}
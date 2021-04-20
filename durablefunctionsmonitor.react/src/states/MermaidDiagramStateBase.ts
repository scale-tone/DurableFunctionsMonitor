import { observable } from 'mobx';
import mermaid from 'mermaid';

// Base class for all mermaid-related states
export abstract class MermaidDiagramStateBase {

    @observable
    protected _diagramCode: string;
    @observable
    protected _diagramSvg: string;

    protected initMermaidWhenNeeded() : void {

        if (MermaidDiagramStateBase._mermaidInitialized) { 
            return;
        }

        mermaid.initialize({
            startOnLoad: true,
            securityLevel: 'loose',
            
            sequence: {
                noteMargin: 0,
                boxMargin: 5,
                boxTextMargin: 5
            },

            flowchart: {
                curve: 'Basis',
                useMaxWidth: true,
                htmlLabels: false
            }
        });

        MermaidDiagramStateBase._mermaidInitialized = true;
    }

    protected escapeTitle(id: string) {

        return id.replace(/[@:;]/g, ' ');
    }

    protected formatDuration(durationInMs: number): string {

        var result = '';
        if (isNaN(durationInMs) || (durationInMs < 0)) {
            return result;
        }

        const days = Math.floor(durationInMs / 86400000);
        if (days > 30) {
            // something went wrong...
            return result;
        }

        var c = 0;

        if (days > 0) {
            result += days.toFixed(0) + 'd';
            ++c;
            durationInMs = durationInMs % 86400000;
        }

        const hours = Math.floor(durationInMs / 3600000);
        if (hours > 0) {
            result += hours.toFixed(0) + 'h';

            if (++c > 1) {
                return `(${result})`;
            }

            durationInMs = durationInMs % 3600000;
        }

        const minutes = Math.floor(durationInMs / 60000);
        if (minutes > 0) {
            result += minutes.toFixed(0) + 'm';

            if (++c > 1) {
                return `(${result})`;
            }

            durationInMs = durationInMs % 60000;
        }

        const seconds = Math.floor(durationInMs / 1000);
        if (seconds > 0) {
            result += seconds.toFixed(0) + 's';

            if (++c > 1) {
                return `(${result})`;
            }

            durationInMs = durationInMs % 1000;
        }

        if (durationInMs > 0) {
            result += durationInMs.toFixed(0) + 'ms';
        }

        if (!result) {
            result = '0ms';
        }

        return `(${result})`;
    }

    protected formatDateTime(timestamp: string): string {

        return timestamp.substr(0, 23);
    }

    protected formatDurationInSeconds(durationInMs: number): string {

        return Math.round(durationInMs / 1000).toFixed(0) + 's';
    }

    private static _mermaidInitialized = false;
}
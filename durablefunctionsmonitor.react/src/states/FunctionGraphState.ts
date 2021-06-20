import { observable, computed } from 'mobx';
import mermaid from 'mermaid';

import { IBackendClient } from '../services/IBackendClient';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';
import { buildFunctionDiagramCode } from './az-func-as-a-graph/buildFunctionDiagramCode';

// State of FunctionGraph view
export class FunctionGraphState extends MermaidDiagramStateBase {

    @observable
    errorMessage: string = '';

    @computed
    get diagramCode(): string { return this._diagramCode; };

    @computed
    get diagramSvg(): string { return this._diagramSvg; };

    @computed
    get inProgress(): boolean { return this._inProgress; };

    get projectPath(): string { return this._projectPath; };

    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(private _projectPath: string,
        private _backendClient: IBackendClient) {
        super();
    }

    gotoFunctionCode(functionName: string): void {

        this.backendClient.call('GotoFunctionCode', functionName).then(() => { }, err => {
            console.log(`Failed to goto function code: ${err.message}`);
        });
    }

    load() {

        if (this._inProgress) {
            return;
        }

        // Only doing this on demand, just in case
        this.initMermaidWhenNeeded();

        this._inProgress = true;
        this.errorMessage = '';
        this._diagramCode = '';
        this._diagramSvg = '';

        this._backendClient.call('TraverseFunctionProject', this._projectPath).then(response => {

            try {
                const diagramCode = buildFunctionDiagramCode(response.functions);

                if (!diagramCode) {
                    this._inProgress = false;
                    return;
                }

                this._diagramCode = `graph LR\n${diagramCode}`;

                // Also making nodes look like they're clickable
                const clickCode = Object.keys(response.functions)
                    .filter(name => !!response.functions[name].filePath)
                    .map(name => `click ${name} null\n`).join('');

                mermaid.render('mermaidSvgId', this._diagramCode + clickCode, (svg) => {

                    this._diagramSvg = this.applyIcons(svg, response.iconsSvg);

                    this._inProgress = false;
                });

            } catch (err) {
                this.errorMessage = `Failed to render: ${err.message}`;
                this._inProgress = false;
            }

        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to traverse: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    @observable
    private _inProgress: boolean = false;

    private applyIcons(svg: string, iconsSvg: string): string {

        // Placing icons code into a <defs> block at the top
        svg = svg.replace(`><style>`, `>\n<defs>\n${iconsSvg}</defs>\n<style>`);

        // Adding <use> blocks referencing relevant icons
        svg = svg.replace(/<g class="node (\w+).*?<g class="label" transform="translate\([0-9,.-]+\)"><g transform="translate\([0-9,.-]+\)">/g,
            `$&<use href="#az-icon-$1" width="20px" height="20px"/>`);

        return svg;
    }
}
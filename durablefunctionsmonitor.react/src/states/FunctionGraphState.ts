import { observable, computed } from 'mobx';
import mermaid from 'mermaid';

import { IBackendClient } from '../services/IBackendClient';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';
import { buildFunctionDiagramCode } from './az-func-as-a-graph/buildFunctionDiagramCode';
import { FunctionsMap, ProxiesMap } from './az-func-as-a-graph/FunctionsMap';

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

    @computed
    get functionsLoaded(): boolean { return !!this._traverseResult; };

    @computed
    get renderFunctions(): boolean { return this._renderFunctions; };
    set renderFunctions(val: boolean) {
        this._renderFunctions = val;
        this.render();
    };

    @computed
    get renderProxies(): boolean { return this._renderProxies; };
    set renderProxies(val: boolean) {
        this._renderProxies = val;
        this.render();
    };
    
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

    render() {
        
        this._diagramCode = '';
        this._diagramSvg = '';
        this.errorMessage = '';

        if (!this._traverseResult) {
            return;
        }

        this._inProgress = true;
        try {
            const diagramCode = buildFunctionDiagramCode(this._traverseResult.functions, this._traverseResult.proxies,
                {
                    doNotRenderFunctions: !this._renderFunctions,
                    doNotRenderProxies: !this._renderProxies
                });

            if (!diagramCode) {
                this._inProgress = false;
                return;
            }

            this._diagramCode = `graph LR\n${diagramCode}`;

            mermaid.render('mermaidSvgId', this._diagramCode, (svg) => {

                this._diagramSvg = this.applyIcons(svg, this._traverseResult.iconsSvg);

                this._inProgress = false;
            });

        } catch (err) {
            this.errorMessage = `Failed to render: ${err.message}`;
            this._inProgress = false;
        }
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
        this._traverseResult = null;

        this._backendClient.call('TraverseFunctionProject', this._projectPath).then(response => {

            this._traverseResult = response;
            this.render();

        }, err => {
            this._inProgress = false;
            this.errorMessage = `Failed to traverse: ${err.message}.${(!!err.response ? err.response.data : '')} `;
        });
    }

    @observable
    private _inProgress: boolean = false;
    @observable
    private _renderFunctions: boolean = true;
    @observable
    private _renderProxies: boolean = true;
    @observable
    private _traverseResult: { functions: FunctionsMap, proxies: ProxiesMap, iconsSvg: string };

    private applyIcons(svg: string, iconsSvg: string): string {

        // Placing icons code into a <defs> block at the top
        svg = svg.replace(`><style>`, `>\n<defs>\n${iconsSvg}</defs>\n<style>`);

        // Adding <use> blocks referencing relevant icons
        svg = svg.replace(/<g class="node (\w+).*?<g class="label" transform="translate\([0-9,.-]+\)"><g transform="translate\([0-9,.-]+\)">/g,
            `$&<use href="#az-icon-$1" width="20px" height="20px"/>`);

        return svg;
    }
}
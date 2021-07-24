import { observable, computed } from 'mobx';

import { IBackendClient } from '../services/IBackendClient';
import { MermaidDiagramStateBase } from './MermaidDiagramStateBase';
import { FunctionsMap, ProxiesMap } from './az-func-as-a-graph/FunctionsMap';

// Base class for all Function Graph states
export class FunctionGraphStateBase extends MermaidDiagramStateBase {

    @computed
    get diagramCode(): string { return this._diagramCode; };

    @computed
    get diagramSvg(): string { return this._diagramSvg; };

    @computed
    get functionsLoaded(): boolean { return !!this._traversalResult; };

    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(protected _backendClient: IBackendClient) {
        super();
    }

    gotoFunctionCode(functionName: string): void {

        this.backendClient.call('GotoFunctionCode', functionName).then(() => { }, err => {
            console.log(`Failed to goto function code: ${err.message}`);
        });
    }

    @observable
    protected _renderFunctions: boolean = true;
    @observable
    protected _renderProxies: boolean = true;
    @observable
    protected _traversalResult: { functions: FunctionsMap, proxies: ProxiesMap, iconsSvg: string };

    protected applyIcons(svg: string, iconsSvg: string): string {

        // Placing icons code into a <defs> block at the top
        svg = svg.replace(`><style>`, `>\n<defs>\n${iconsSvg}</defs>\n<style>`);

        // Adding <use> blocks referencing relevant icons
        svg = svg.replace(/<g class="node (\w+).*?<g class="label" transform="translate\([0-9,.-]+\)"><g transform="translate\([0-9,.-]+\)">/g,
            `$&<use href="#az-icon-$1" width="20px" height="20px"/>`);

        return svg;
    }
}
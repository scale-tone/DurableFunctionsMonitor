import { observable, computed } from 'mobx';

import { IBackendClient } from '../services/IBackendClient';
import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ICustomTabState } from './ICustomTabState';

// State of a custom liquid markup tab on OrchestrationDetails view
export class LiquidMarkupTabState implements ICustomTabState {

    name: string = "";
    readonly description: string = "";
    readonly isMermaidDiagram: boolean = false;

    @computed
    get rawHtml(): string { return this._rawHtml; };

    constructor(private _orchestrationId: string, private _backendClient: IBackendClient) {
    }

    load(details: DurableOrchestrationStatus): Promise<void> {
        
        return new Promise<void>((resolve, reject) => {

            const uri = `/orchestrations('${this._orchestrationId}')/custom-tab-markup('${this.name}')`;

            this._backendClient.call('POST', uri).then(response => { 

                this._rawHtml = response;
                resolve();

            }, reject);
        });
    }

    @observable
    private _rawHtml: string;
}
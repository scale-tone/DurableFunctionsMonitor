import { observable, computed } from 'mobx';

import { IBackendClient } from '../services/IBackendClient';
import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ICustomTabState } from './OrchestrationDetailsState';

// State of a custom liquid markup tab on OrchestrationDetails view
export class LiquidMarkupTabState implements ICustomTabState {

    readonly description: string = "";

    @computed
    get rawHtml(): string { return this._rawHtml; };

    constructor(readonly name: string,
        private _orchestrationId: string,
        private _backendClient: IBackendClient) {
    }

    load(details: DurableOrchestrationStatus): Promise<void> {
        
        if (!!this._rawHtml) {
            return Promise.resolve();
        }

        return new Promise<void>((resolve, reject) => {

            const uri = `/orchestrations('${this._orchestrationId}')/custom-tab-markup('${this.name}')`;

            this._backendClient.call('POST', uri).then(response => { 

                this._rawHtml = response;
                console.log(this._rawHtml);
                resolve();

            }, reject);
        });
    }

    @observable
    private _rawHtml: string;
}
import axios, { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

export const BackendUri = process.env.REACT_APP_BACKEND_BASE_URI + process.env.REACT_APP_BACKEND_PATH;

// Common IBackendClient implementation, sends HTTP requests directly
export class BackendClient implements IBackendClient {

    get isVsCode(): boolean { return false; }

    get taskHubName(): string { return this._getTaskHubName(); }

    constructor(private _getTaskHubName: () => string, private _getAuthorizationHeaderAsync: () => Promise<{ Authorization: string }>) {
    }

    call(method: Method, url: string, data?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {

            this._getAuthorizationHeaderAsync().then(headers => {

                axios.request({
                    url: BackendUri + '/' + this._getTaskHubName() + url,
                    method, data, headers
                }).then(r => { resolve(r.data); }, reject);
            });
        });
    }
}
import axios, { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

export const BackendBaseUri = process.env.REACT_APP_BACKEND_BASE_URI as string;

// Common IBackendClient implementation, sends HTTP requests directly
export class BackendClient implements IBackendClient {

    constructor(private _getAuthorizationHeaderAsync: () => Promise<{ Authorization: string }>) {
    }

    call(method: Method, url: string, data?: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {

            this._getAuthorizationHeaderAsync().then(headers => {

                axios.request({
                    url: BackendBaseUri + url,
                    method, data, headers
                }).then(r => { resolve(r.data); }, reject);
            });
        });
    }
}
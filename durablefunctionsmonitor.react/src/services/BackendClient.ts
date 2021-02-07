import axios, { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

// DFM-specific route prefix, that is passed to us from the backend via a global static variable
declare const DfmClientConfig: { routePrefix: string };

const RoutePrefix = !process.env.REACT_APP_BACKEND_BASE_URI ? (!DfmClientConfig.routePrefix ? '/' : `/${DfmClientConfig.routePrefix}/`) : process.env.REACT_APP_BACKEND_BASE_URI + '/';
export const BackendUri = RoutePrefix + process.env.REACT_APP_BACKEND_PATH;

// Common IBackendClient implementation, sends HTTP requests directly
export class BackendClient implements IBackendClient {

    get isVsCode(): boolean { return false; }

    get routePrefixAndTaskHubName(): string { return RoutePrefix + this._getTaskHubName(); }

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
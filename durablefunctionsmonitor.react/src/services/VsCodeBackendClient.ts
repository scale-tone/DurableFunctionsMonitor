import { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

// IBackendClient implementation for VsCode extension, forwards HTTP requests to VsCode
export class VsCodeBackendClient implements IBackendClient {

    get isVsCode(): boolean { return true; }

    constructor(private _vsCodeApi: any) {

        // Handling responses from VsCode
        window.addEventListener('message', event => {

            const response = event.data;

            const requestPromise = this._requests[response.id];
            if (!requestPromise) {
                return;
            }

            if (!!response.data) {
                requestPromise.resolve(response.data);
            } else {
                requestPromise.reject(response.err);
            }

            delete this._requests[response.id];
        });
    }

    call(method: Method | 'OpenInNewWindow', url: string, data?: any): Promise<any> {

        const requestId = Math.random().toString();

        // Sending request to VsCode
        this._vsCodeApi.postMessage({ id: requestId, method, url, data });

        return new Promise<any>((resolve, reject) => {
            this._requests[requestId] = { resolve, reject };
        });
    }

    private _requests: {
        [id: string]: {
            resolve: (value?: any) => void,
            reject: (reason?: any) => void
        }
    } = {};

}
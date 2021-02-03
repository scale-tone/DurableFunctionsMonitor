import { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

// IBackendClient implementation for VsCode extension, forwards HTTP requests to VsCode
export class VsCodeBackendClient implements IBackendClient {

    get isVsCode(): boolean { return true; }

    get routePrefixAndTaskHubName(): string { return null; }

    constructor(private _vsCodeApi: any) {

        // Handling responses from VsCode
        window.addEventListener('message', event => {

            const message = event.data;

            // handling menu commands
            const requestHandler = this._handlers[message.id];
            if (!!requestHandler) {

                try {
                    requestHandler(message.data);
                } catch(err) {
                    console.log('Failed to handle response from VsCode: ' + err);
                }

                return;
            }

            // handling HTTP responses
            const requestPromise = this._requests[message.id];
            if (!requestPromise) {
                return;
            }

            if (!!message.err) {
                requestPromise.reject(message.err);
            } else {
                requestPromise.resolve(message.data);
            }

            delete this._requests[message.id];
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

    setCustomHandlers(purgeHistoryHandler: () => void, cleanEntityStorageHandler: () => void) {

        this._handlers['purgeHistory'] = purgeHistoryHandler;
        this._handlers['cleanEntityStorage'] = cleanEntityStorageHandler;

        // Notifying VsCode that we're ready to process messages
        // Cannot do this in ctor, because VsCodeBackendClient and PurgeHistoryDialogState depend on each other
        this._vsCodeApi.postMessage({ method: 'IAmReady' });
    }

    private _handlers: {
        [id: string]: (data: any) => void
    } = {};

    private _requests: {
        [id: string]: {
            resolve: (value?: any) => void,
            reject: (reason?: any) => void
        }
    } = {};
}
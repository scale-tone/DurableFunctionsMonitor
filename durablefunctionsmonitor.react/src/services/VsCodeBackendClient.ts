import { Method } from 'axios';
import { IBackendClient } from './IBackendClient';

// IBackendClient implementation for VsCode extension, forwards HTTP requests to VsCode
export class VsCodeBackendClient implements IBackendClient {

    get isVsCode(): boolean { return true; }

    constructor(private _vsCodeApi: any) {

        console.log('VsCodeBackendClient ctor');

        // Handling responses from VsCode
        window.addEventListener('message', event => {


            const message = event.data;

            console.log('Message: ' + JSON.stringify(message));

            // handling menu commands
            const requestHandler = this._handlers[message.id];
            if (!!requestHandler) {

                console.log('Executing handler for messageId ' + message.id + ' - ' + JSON.stringify(requestHandler));

                try {
                    requestHandler(message.data);

                    console.log('handler succeeded');
                    
                } catch(err) {
                    console.log('Error: ' + err);
                }


                return;
            }

            // handling HTTP responses
            const requestPromise = this._requests[message.id];
            if (!requestPromise) {
                return;
            }

            if (!!message.data) {
                requestPromise.resolve(message.data);
            } else {
                requestPromise.reject(message.err);
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

    setPurgeHistoryHandler(handler: (data: any) => void) {
        this._handlers['purgeHistory'] = handler;

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
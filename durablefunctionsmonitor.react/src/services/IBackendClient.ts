import { Method } from 'axios';

// Interface for communicating with the backend (sending HTTP requests)
export interface IBackendClient {

    isVsCode: boolean;

    routePrefixAndTaskHubName: string;

    // Sends a request to the backend
    call(method: Method | 'OpenInNewWindow' | 'SaveAs', url: string, data?: any): Promise<any>;   
}
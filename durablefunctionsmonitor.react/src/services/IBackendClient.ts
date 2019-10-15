import { Method } from 'axios';

// Interface for communicating with the backend (sending HTTP requests)
export interface IBackendClient {

    isVsCode: boolean;

    // Sends a request to the backend
    call(method: Method | 'OpenInNewWindow', url: string, data?: any): Promise<any>;   
}
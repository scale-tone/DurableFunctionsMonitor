import { Method } from 'axios';

// Interface for communicating with the backend (sending HTTP requests)
export interface IBackendClient {

    isVsCode: boolean;

    taskHubName: string;

    // Sends a request to the backend
    call(method: Method | 'OpenInNewWindow' | 'SaveAs', url: string, data?: any): Promise<any>;   
}
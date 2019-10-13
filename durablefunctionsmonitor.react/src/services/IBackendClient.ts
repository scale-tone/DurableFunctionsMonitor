import { Method } from 'axios';

// Interface for communicating with the backend (sending HTTP requests)
export interface IBackendClient {

    // Sends an HTTP request to the backend
    call(method: Method, url: string, data?: any): Promise<any>;   
}
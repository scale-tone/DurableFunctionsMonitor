import { observable } from 'mobx'

export const BackendBaseUri = process.env.REACT_APP_BACKEND_BASE_URI as string;

// State of Error Message snackbar
export class ErrorMessageState {

    @observable
    errorMessage: string = '';
}
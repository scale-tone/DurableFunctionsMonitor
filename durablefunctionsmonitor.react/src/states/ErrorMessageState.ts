import { observable } from 'mobx'

// State of Error Message snackbar
export class ErrorMessageState {

    @observable
    errorMessage: string = '';
}
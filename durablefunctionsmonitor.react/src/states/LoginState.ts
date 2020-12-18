import { action, observable, computed } from 'mobx'
import axios, { AxiosResponse } from 'axios';
import * as Msal from 'msal';

import { ErrorMessageState } from './ErrorMessageState';

import { BackendUri } from '../services/BackendClient';

// Login State
export class LoginState extends ErrorMessageState {

    @computed
    get isLoggedIn(): boolean { return this._isLoggedIn; };

    @computed
    get isLoggedInAnonymously(): boolean { return !this._userName; };

    @computed
    get userName(): string { return this._userName; };

    @observable
    menuAnchorElement?: Element;

    constructor(private _rootUri: string) {
        super();
        this.login();
    }

    login() {
        const uri = `${BackendUri}/easyauth-config`;
        axios.get(uri).then(this.loginWithEasyAuthConfig, err => {
            this.errorMessage = `${err.message}.${(!!err.response ? err.response.data : '')}`;
        });
    }

    logout() {
        this.menuAnchorElement = undefined;
        this._aadApp.logout();
    }

    getAuthorizationHeaderAsync() {

        // Let's think we're on localhost and proceed with no auth
        if (!this._aadApp) {
            return new Promise<undefined>((resolve, reject) => resolve(undefined));
        }

        return new Promise<{ Authorization: string }>((resolve, reject) => {
            // Obtaining a token to access our own AAD app
            const authParams: Msal.AuthenticationParameters = {
                scopes: [this._aadApp.getCurrentConfiguration().auth.clientId],
                redirectUri: this._rootUri
            };

            console.log(`DFM: set redirectUri to ${authParams.redirectUri}`);

            this._aadApp.acquireTokenSilent(authParams)
                .then((authResponse) => {

                    var accessToken = authResponse.accessToken;
                    if (!accessToken) {
                        // https://github.com/AzureAD/microsoft-authentication-library-for-js/issues/736
                        // accessToken might randomly be returned as null, in which case we can probably use id_token
                        // (which is supposed to be the same)
                        console.log('DFM: accessToken is null, so using idToken.rawIdToken instead');
                        accessToken = authResponse.idToken.rawIdToken;
                    }

                    resolve({ Authorization: `Bearer ${accessToken}` });

                }, err => {
                    // If silent token aquiring failed, then just redirecting the user back to AAD, 
                    // so that the page is reloaded anyway.
                    // This is supposed to happen very rarely, as default refresh token lifetime is quite long.  
                    console.log(`DFM: acquireTokenSilent() failed (${err}), so calling acquireTokenRedirect()...`);
                    this._aadApp.acquireTokenRedirect(authParams);
                });
        });
    }

    @observable
    private _isLoggedIn: boolean = false;

    @observable
    private _userName: string;

    private _aadApp: Msal.UserAgentApplication;

    @action.bound
    private loginWithEasyAuthConfig(easyAuthConfigResponse: AxiosResponse<any>) {

        const config = easyAuthConfigResponse.data;
        if (!config.clientId) {
            // Let's think we're on localhost and proceed with no auth
            this._isLoggedIn = true;
            return;
        }

        // Configuring MSAL with values received from backend
        this._aadApp = new Msal.UserAgentApplication({
            auth: {
                clientId: config.clientId,
                authority: config.authority
            }
        })

        // Checking if it was a redirect from AAD
        this._aadApp.handleRedirectCallback(() => { }, this.handleRedirectCallbackFailed);
        const account = this._aadApp.getAccount();

        if (!account) {
            // Redirecting user to AAD. Redirect flow is more reliable (doesn't need popups enabled)
            console.log('DFM: redirecting user to AAD for login...');

            const authParams: Msal.AuthenticationParameters = {
                scopes: [this._aadApp.getCurrentConfiguration().auth.clientId],
                redirectUri: this._rootUri,
                redirectStartPage: window.location.href
            };

            console.log(`DFM: set redirectUri to ${authParams.redirectUri}`);

            this._aadApp.loginRedirect(authParams);
        } else {
            // We've logged in successfully. Setting user name.
            this._userName = account.userName;
            this._isLoggedIn = true;
        }
    }

    @action.bound
    private handleRedirectCallbackFailed(authErr: Msal.AuthError, accountState: string) {
        this.errorMessage = `Failed to handle login redirect. name: ${authErr.name}, message: ${authErr.message}, errorCode: ${authErr.errorCode}, errorMessage: ${authErr.errorMessage}, accountState: ${accountState}`;
    }
}
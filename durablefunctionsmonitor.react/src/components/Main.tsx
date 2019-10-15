import * as React from 'react';
import { observer } from 'mobx-react';

import { AppBar, Breadcrumbs, Box, Link, Toolbar, Typography } from '@material-ui/core';

const logo = require('../logo.svg');
import './Main.css';

import { MainState } from '../states/MainState';

import { LoginIcon } from './LoginIcon';
import { MainMenu } from './MainMenu';
import { Orchestrations } from './Orchestrations';
import { OrchestrationDetails } from './OrchestrationDetails';

export const UriSuffix = process.env.REACT_APP_URI_SUFFIX as string;

// The main application view
@observer
export class Main extends React.Component<{ state: MainState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <div>

                {!!state.loginState && (
                    <AppBar position="static" color="default" className="app-bar">
                        <Toolbar>

                            {state.loginState.isLoggedIn && !!state.mainMenuState && (
                                <MainMenu state={state.mainMenuState} />
                            )}

                            <img src={logo} width="30px"></img>
                            <Box width={5} />

                            <Typography variant="h6" color="inherit" className="title-typography">
                                Durable Functions Monitor
                            </Typography>

                            <Breadcrumbs color="inherit">
                                <Link color="inherit" href={UriSuffix}>
                                    / orchestrations
                                </Link>
                                {!!state.orchestrationDetailsState && (
                                    <Typography color="inherit">
                                        {state.orchestrationDetailsState.orchestrationId}
                                    </Typography>
                                )}
                            </Breadcrumbs>

                            <Typography style={{ flex: 1 }} />

                            <LoginIcon state={state.loginState} />
                        </Toolbar>
                    </AppBar>
                )}

                {!!state.orchestrationsState && (!state.loginState || state.loginState.isLoggedIn) && (
                    <Orchestrations state={state.orchestrationsState} />
                )}

                {!!state.orchestrationDetailsState && (!state.loginState || state.loginState.isLoggedIn) && (
                    <OrchestrationDetails state={state.orchestrationDetailsState} />
                )}

            </div>
        );
    }
}
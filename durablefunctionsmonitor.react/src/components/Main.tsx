import * as React from 'react';
import { observer } from 'mobx-react';

import { BrowserRouter, Route } from 'react-router-dom';
import { AppBar, Breadcrumbs, Box, Link, Toolbar, Typography } from '@material-ui/core';

const logo = require('../logo.svg');
import './Main.css';

import { MainState } from '../states/MainState';

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
            <BrowserRouter basename={UriSuffix}>
                <AppBar position="static" color="default" className="app-bar">
                    <Toolbar>
                        <img src={logo} width="30px"></img>

                        <Box width={5} />

                        <Typography variant="h6" color="inherit" className="title-typography">
                            Durable Functions Monitor
                        </Typography>

                        <Breadcrumbs color="inherit">
                            <Link color="inherit" href={UriSuffix}>
                                / orchestrations
                            </Link>
                            <Typography color="inherit">
                                {state.orchestrationDetailsState.orchestrationId}
                            </Typography>
                        </Breadcrumbs>

                        <Box width={5} />
                        <Typography style={{ flex: 1 }} />

                        {!state.orchestrationDetailsState.orchestrationId && (<MainMenu state={state.mainMenuState} />)}
                        
                    </Toolbar>
                </AppBar>

                <Route path="/" exact component={() => (<Orchestrations state={state.orchestrationsState} />)} />

                <Route path="/orchestrations/:id" component={(props: any) => {
                    state.orchestrationDetailsState.orchestrationId = props.match.params.id;
                    return (<OrchestrationDetails state={state.orchestrationDetailsState} />);
                }} />

            </BrowserRouter>
        );
    }
}
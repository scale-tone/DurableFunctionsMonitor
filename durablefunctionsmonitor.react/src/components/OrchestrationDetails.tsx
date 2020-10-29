import * as React from 'react';
import { observer } from 'mobx-react';

import {
    AppBar, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper,
    Select, Tabs, Tab, Toolbar, Typography
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';

import './OrchestrationDetails.css';

import { DurableEntityButtons } from './DurableEntityButtons';
import { DurableEntityFields } from './DurableEntityFields';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationButtons } from './OrchestrationButtons';
import { OrchestrationDetailsState, DetailsTabEnum } from '../states/OrchestrationDetailsState';
import { OrchestrationFields } from './OrchestrationFields';

// Orchestration Details view
@observer
export class OrchestrationDetails extends React.Component<{ state: OrchestrationDetailsState }> {

    componentDidMount() {

        // Triggering initial load
        this.props.state.loadDetails();
    }
    
    render(): JSX.Element {
        const state = this.props.state;

        return (<>
            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
           
            <Toolbar variant="dense" className="top-toolbar">

                {state.details.entityType === "Orchestration" && (
                    <OrchestrationButtons state={state} />
                )}
                {state.details.entityType === "DurableEntity" && (
                    <DurableEntityButtons state={state} />
                )}
                
                <Box width={20} />
                <Typography style={{ flex: 1 }} />

                <FormControl>
                    <InputLabel htmlFor="auto-refresh-select">Auto-refresh</InputLabel>
                    <Select
                        className="toolbar-select"
                        value={state.autoRefresh}
                        onChange={(evt) => state.autoRefresh = evt.target.value as number}
                        inputProps={{ id: 'auto-refresh-select' }}>
                        <MenuItem value={0}>Never</MenuItem>
                        <MenuItem value={1}>Every 1 sec.</MenuItem>
                        <MenuItem value={5}>Every 5 sec.</MenuItem>
                        <MenuItem value={10}>Every 10 sec.</MenuItem>
                    </Select>
                </FormControl>

                <Box width={20} />

                <Button className="details-refresh-button" variant="outlined" color="default" size="large" onClick={() => state.loadDetails()}>
                    <RefreshIcon />
                </Button>

            </Toolbar>

            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
            
            {state.details.entityType === "Orchestration" && (<>

                <AppBar color="inherit" position="static">
                    <Tabs value={state.selectedTab}
                        onChange={(ev: React.ChangeEvent<{}>, val: DetailsTabEnum) => state.selectedTab = val}
                    >
                        <Tab label="Details" disabled={state.inProgress} />
                        <Tab label="Sequence Diagram" disabled={state.inProgress} />
                    </Tabs>
                </AppBar>

                {state.selectedTab === DetailsTabEnum.Details &&
                    (<OrchestrationFields details={state.details} backendClient={state.backendClient} />)
                }
                {state.selectedTab === DetailsTabEnum.SequenceDiagram &&
                    (<div className="sequence-diagram" dangerouslySetInnerHTML={{ __html: state.sequenceDiagramSvg }} />)
                }

            </>)}

            {state.details.entityType === "DurableEntity" && (
                <DurableEntityFields details={state.details} />
            )}

            <ErrorMessage state={this.props.state} />
        </>);
    }
}
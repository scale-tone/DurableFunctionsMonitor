import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Select, Toolbar, Typography
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';

import './OrchestrationDetails.css';

import { DurableEntityButtons } from './DurableEntityButtons';
import { DurableEntityFields } from './DurableEntityFields';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationButtons } from './OrchestrationButtons';
import { OrchestrationDetailsState } from '../states/OrchestrationDetailsState';
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

        return (<div>
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

            {state.details.entityType === "Orchestration" && (
                <OrchestrationFields details={state.details} backendClient={state.backendClient} />
            )}
            {state.details.entityType === "DurableEntity" && (
                <DurableEntityFields details={state.details} />
            )}

            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
            <Box height={10} /> 

            <ErrorMessage state={this.props.state} />
            
        </div>);
    }
}
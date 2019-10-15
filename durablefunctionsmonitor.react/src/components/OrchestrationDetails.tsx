import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, FormHelperText, Grid, InputBase, InputLabel, LinearProgress, MenuItem, Select,
    Table, TableBody, TableCell, TableHead, TableRow, Toolbar, Typography, TextField
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';

import './OrchestrationDetails.css';

import { ErrorMessage } from './ErrorMessage';
import { HistoryEventFields } from '../states/DurableOrchestrationStatus';
import { OrchestrationDetailsState } from '../states/OrchestrationDetailsState';

// Orchestration Details view
@observer
export class OrchestrationDetails extends React.Component<{ state: OrchestrationDetailsState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (<div>
            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
           
            <Toolbar variant="dense" className="top-toolbar">

                <Button variant="outlined" color="primary" size="large" onClick={() => state.rewindConfirmationOpen = true}>
                    Rewind
                </Button>
                <Box width={20} />
                <Button variant="outlined" color="primary" size="large" onClick={() => state.terminateConfirmationOpen = true}>
                    Terminate
                </Button>
                <Box width={20} />
                <Button variant="outlined" color="primary" size="large" onClick={() => state.raiseEventDialogOpen = true}>
                    Raise Event
                </Button>
                
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

                <Button variant="outlined" color="default" size="large" onClick={() => state.loadDetails()}>
                    <RefreshIcon />
                </Button>

            </Toolbar>

            {this.renderDetails(state.details)}

            <FormHelperText className="history-events-count-label">
                historyEvents: {!!state.details.historyEvents ? state.details.historyEvents.length : 0} items
            </FormHelperText>

            {(!!state.details.historyEvents && state.details.historyEvents.length) ?
                this.renderTable(state.details.historyEvents) :
                this.renderEmptyTable()}

            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
            <Box height={10} /> 

            <ErrorMessage state={this.props.state} />
            
            {this.renderDialogs(state)}
        </div>);
    }

    private renderDialogs(state: OrchestrationDetailsState): JSX.Element {
        
        return (<div>

            <Dialog
                open={state.rewindConfirmationOpen}
                onClose={() => state.rewindConfirmationOpen = false}
            >
                <DialogTitle>Confirm Rewind</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You're about to rewind orchestration '{state.orchestrationId}'. Are you sure?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => state.rewindConfirmationOpen = false} color="primary" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={() => state.rewind()} color="secondary">
                        Yes, rewind
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={state.terminateConfirmationOpen}
                onClose={() => state.terminateConfirmationOpen = false}
            >
                <DialogTitle>Confirm Terminate</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You're about to terminate orchestration '{state.orchestrationId}'. This operation cannot be undone. Are you sure?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => state.terminateConfirmationOpen = false} color="primary" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={() => state.terminate()} color="secondary">
                        Yes, terminate
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={state.raiseEventDialogOpen}
                onClose={() => state.raiseEventDialogOpen = false}
            >
                <DialogTitle>Raise Event</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Provide event name and some additional data.
                    </DialogContentText>

                    <TextField
                        autoFocus
                        margin="dense"
                        label="Event Name"
                        fullWidth
                        value={state.eventName}
                        onChange={(evt) => state.eventName = evt.target.value as string}
                    />

                    <TextField
                        margin="dense"
                        label="Event Data (JSON)"
                        fullWidth
                        multiline
                        rows={7}
                        value={state.eventData}
                        onChange={(evt) => state.eventData = evt.target.value as string}
                    />                    

                </DialogContent>
                <DialogActions>
                    <Button onClick={() => state.raiseEventDialogOpen = false} color="primary">
                        Cancel
                    </Button>
                    <Button onClick={() => state.raiseEvent()} disabled={!state.eventName} color="secondary">
                        Raise
                    </Button>
                </DialogActions>
            </Dialog>
            
        </div>);
    }

    private renderDetails(details: any): JSX.Element {

        return (
            <Grid container className="grid-container">
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="name"
                        value={details.name}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="createdTime"
                        value={details.createdTime}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="runtimeStatus"
                        value={details.runtimeStatus}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                        className={!!details.runtimeStatus ? "runtime-status-" + details.runtimeStatus.toLowerCase() : ""}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="customStatus"
                        value={details.customStatus ? details.customStatus : ""}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="lastUpdatedTime"
                        value={details.lastUpdatedTime}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="input"
                        value={JSON.stringify(details.input)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={5}
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="output"
                        value={JSON.stringify(details.output)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={5}
                    />
                </Grid>
            </Grid>
        );
    }

    private renderEmptyTable(): JSX.Element {
        return (
            <Typography variant="h5" className="empty-table-placeholder" >
                This list is empty
            </Typography>
        );
    }

    private renderTable(events: Array<any>): JSX.Element {

        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {HistoryEventFields.map(col => {
                            return (
                                <TableCell key={col}>{col}</TableCell>
                            );
                        })}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {events.map((event: any, index: number) => {

                        const cellStyle = { verticalAlign: 'top' };
                        return (
                            <TableRow key={index}>
                                <TableCell style={cellStyle}>
                                    {event.Timestamp}
                                </TableCell>
                                <TableCell className="name-cell" style={cellStyle}>
                                    {event.EventType}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {!!event.Name ? event.Name : event.FunctionName}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {event.ScheduledTime}
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly 
                                        value={JSON.stringify(event.Result)}
                                    />
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={event.Details}
                                    />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }
}
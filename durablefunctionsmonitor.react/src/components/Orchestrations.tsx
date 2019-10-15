import * as React from 'react';
import { action } from 'mobx'
import { observer } from 'mobx-react';

import {
    Box, Button, Checkbox, FormControl, FormHelperText, InputBase, InputLabel, LinearProgress, Link, MenuItem, Select,
    Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, TextField, Toolbar, Typography
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';

import './Orchestrations.css';

import { DurableOrchestrationStatusFields } from '../states/DurableOrchestrationStatus';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationLink } from './OrchestrationLink';
import { OrchestrationsState } from '../states/OrchestrationsState';

export const UriSuffix = process.env.REACT_APP_URI_SUFFIX as string;

// Orchestrations view
@observer
export class Orchestrations extends React.Component<{ state: OrchestrationsState }> {

    componentDidMount() {

        // Triggering initial load
        this.props.state.loadOrchestrations();

        // Doing a simple infinite scroll
        document.addEventListener('scroll', (evt) => {

            const scrollingElement = (evt.target as Document).scrollingElement;
            if (!scrollingElement) { 
                return;
            }

            const scrollPos = scrollingElement.scrollHeight - window.innerHeight - scrollingElement.scrollTop;
            const scrollPosThreshold = 100;

            if (scrollPos < scrollPosThreshold) {
                this.props.state.loadOrchestrations();
            }
        });
    }

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <div>
                {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

                <Toolbar variant="dense" className="top-toolbar">

                    <TextField
                        label="From &nbsp;&nbsp; (UTC)"
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        value={this.formatDateTime(state.timeFrom)}
                        onChange={(evt) => { state.timeFrom = this.getDateTimeValue(evt); }}
                        onBlur={() => state.applyTimeFrom()}
                        onKeyPress={this.handleKeyPress}
                    />                    

                    <Box width={20}/>

                    <FormControl>
                        <InputLabel className="till-label" htmlFor="till-checkbox" shrink >Till</InputLabel>
                        <Checkbox
                            id="till-checkbox"
                            className="till-checkbox"
                            checked={state.timeTillEnabled}
                            onChange={(evt) => state.timeTillEnabled = evt.target.checked }
                        />
                    </FormControl>
                    
                    <TextField
                        className="till-input"
                        label="(UTC)"
                        placeholder="[Now]"
                        InputLabelProps={{ shrink: true }}
                        type={state.timeTillEnabled ? "datetime-local" : "text"}
                        disabled={!state.timeTillEnabled}
                        value={state.timeTillEnabled ? this.formatDateTime(state.timeTill) : ''}
                        onChange={(evt) => { state.timeTill = this.getDateTimeValue(evt); }}
                        onBlur={() => state.applyTimeTill()}
                        onKeyPress={this.handleKeyPress}
                    />

                    <Box width={20} />

                    <FormControl>
                        <InputLabel htmlFor="filtered-column-select">Filtered Column</InputLabel>
                        <Select
                            className="toolbar-select"
                            value={state.filteredColumn}
                            onChange={(evt) => state.filteredColumn = evt.target.value as string}
                            inputProps={{ id: "filtered-column-select" }}>
                            
                            <MenuItem value="0">[Not Selected]</MenuItem>
                            {DurableOrchestrationStatusFields.map(col => {
                                return (<MenuItem key={col} value={col}>{col}</MenuItem>);
                            })}

                        </Select>
                    </FormControl>

                    <Box width={20} />

                    <FormControl>
                        <InputLabel htmlFor="filter-operator-select">Filter Operator</InputLabel>
                        <Select
                            className="toolbar-select"
                            value={state.filterOperator}
                            onChange={(evt) => state.filterOperator = evt.target.value as number}
                            inputProps={{ id: "filter-operator-select" }}>
                            <MenuItem value={0}>Equals</MenuItem>
                            <MenuItem value={1}>Starts With</MenuItem>
                            <MenuItem value={2}>Contains</MenuItem>
                        </Select>
                    </FormControl>

                    <Box width={20} />

                    <TextField
                        label="Filter Value"
                        InputLabelProps={{ shrink: true }}
                        placeholder="[some text or 'null']"
                        disabled={state.filteredColumn === '0'}
                        value={state.filterValue}
                        onChange={(evt) => state.filterValue = evt.target.value as string}
                        onBlur={() => state.applyFilterValue()}
                        onKeyPress={this.handleKeyPress}
                    />

                    <Box width={10} />

                    <Typography style={{ flex: 1 }} />
                    
                    <FormControl>
                        <InputLabel htmlFor="auto-refresh-select">Auto-refresh</InputLabel>
                        <Select
                            className="toolbar-select"
                            inputProps={{ id: "auto-refresh-select" }}
                            value={state.autoRefresh}
                            onChange={(evt) => state.autoRefresh = evt.target.value as number}
                        >
                            <MenuItem value={0}>Never</MenuItem>
                            <MenuItem value={1}>Every 1 sec.</MenuItem>
                            <MenuItem value={5}>Every 5 sec.</MenuItem>
                            <MenuItem value={10}>Every 10 sec.</MenuItem>
                        </Select>
                    </FormControl>

                    <Box width={20} />
                    
                    <Button variant="outlined" color="default" size="large" onClick={() => state.reloadOrchestrations()} >
                        <RefreshIcon />
                    </Button>

                </Toolbar>

                <FormHelperText className="items-count-label">
                    {state.orchestrations.length} items shown
                </FormHelperText>

                {!!state.orchestrations.length ? this.renderTable(state) : this.renderEmptyTable()}

                {state.inProgress && !!state.orchestrations.length ? (<LinearProgress />) : (<Box height={4} />)}
                <Toolbar variant="dense" />
                
                <ErrorMessage state={this.props.state}/>
            </div>
        );
    }

    private renderEmptyTable(): JSX.Element {
        return (
            <Typography variant="h5" className="empty-table-placeholder" >
                This list is empty
            </Typography>
        );
    }

    private renderTable(state: OrchestrationsState): JSX.Element {

        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {DurableOrchestrationStatusFields.map(col => {
                            return (
                                <TableCell key={col}>
                                    <TableSortLabel
                                        active={state.orderBy === col}
                                        direction={state.orderByDirection}
                                        onClick={() => state.orderBy = col}
                                    >
                                        {col}
                                    </TableSortLabel>
                                </TableCell>
                            );
                        })}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {state.orchestrations.map(orchestration => {

                        const cellStyle = { verticalAlign: 'top' };
                        return (
                            <TableRow
                                key={orchestration.instanceId}
                                className={"runtime-status-" + orchestration.runtimeStatus.toLowerCase()}
                            >
                                <TableCell className="instance-id-cell" style={cellStyle}>
                                    <OrchestrationLink orchestrationId={orchestration.instanceId} backendClient={state.backendClient}/>
                                </TableCell>
                                <TableCell className="name-cell" style={cellStyle}>
                                    {orchestration.name}
                                </TableCell>
                                <TableCell className="datetime-cell" style={cellStyle}>
                                    {orchestration.createdTime}
                                </TableCell>
                                <TableCell className="datetime-cell" style={cellStyle}>
                                    {orchestration.lastUpdatedTime}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {orchestration.runtimeStatus}
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={JSON.stringify(orchestration.input)}
                                    />
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={JSON.stringify(orchestration.output)}
                                    />
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    @action.bound
    private handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            // Otherwise the event will bubble up and the form will be submitted
            event.preventDefault();

            this.props.state.reloadOrchestrations();
        }
    }

    private getDateTimeValue(evt: any): Date {

        var dt = new Date(evt.target.value.slice(0, 16) + ':00Z');

        // If invalid date entered, then setting it to current date
        try {
            dt.toISOString();
        } catch (err) {
            dt = new Date();
        }

        return dt;
    }

    private formatDateTime(dt: Date) {
        return dt.toISOString().slice(0, 16);
    }
}
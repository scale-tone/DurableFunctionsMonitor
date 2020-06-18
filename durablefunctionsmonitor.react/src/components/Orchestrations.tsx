import * as React from 'react';
import { action } from 'mobx'
import { observer } from 'mobx-react';

import {
    Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, Grid, InputBase, InputLabel,
    LinearProgress, MenuItem, Select,
    Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, TextField, Toolbar, Typography, Radio, RadioGroup
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';

import './Orchestrations.css';

import { DateTimeHelpers } from '../DateTimeHelpers';
import { DurableOrchestrationStatusFields } from '../states/DurableOrchestrationStatus';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationLink } from './OrchestrationLink';
import { OrchestrationsState, ShowEntityTypeEnum } from '../states/OrchestrationsState';

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

                    <Grid container className="toolbar-grid1">
                        <Grid item xs={12}>
                            <TextField
                                className="from-input"
                                style={{ marginLeft: 10 }}
                                label="From &nbsp;&nbsp; (UTC)"
                                type="datetime-local"
                                InputLabelProps={{ shrink: true }}
                                disabled={state.inProgress}
                                value={DateTimeHelpers.formatDateTime(state.timeFrom)}
                                onChange={(evt) => { state.timeFrom = DateTimeHelpers.getDateTimeValue(evt); }}
                                onBlur={() => state.applyTimeFrom()}
                                onKeyPress={this.handleKeyPress}
                            />
                        </Grid>
                        <Grid item xs={12} className="toolbar-grid1-item2">
                            <FormControl>
                                <InputLabel className="till-label" htmlFor="till-checkbox" shrink >Till</InputLabel>
                                <Checkbox
                                    id="till-checkbox"
                                    className="till-checkbox"
                                    disabled={state.inProgress}
                                    checked={state.timeTillEnabled}
                                    onChange={(evt) => state.timeTillEnabled = evt.target.checked}
                                />
                            </FormControl>
                            <TextField
                                className="till-input"
                                label="(UTC)"
                                placeholder="[Now]"
                                InputLabelProps={{ shrink: true }}
                                type={state.timeTillEnabled ? "datetime-local" : "text"}
                                disabled={!state.timeTillEnabled || state.inProgress}
                                value={state.timeTillEnabled ? DateTimeHelpers.formatDateTime(state.timeTill) : ''}
                                onChange={(evt) => { state.timeTill = DateTimeHelpers.getDateTimeValue(evt); }}
                                onBlur={() => state.applyTimeTill()}
                                onKeyPress={this.handleKeyPress}
                            />
                        </Grid>
                    </Grid>

                    <Grid container className="toolbar-grid2">
                        <Grid item xs={12}>
                            <FormControl>
                                <InputLabel htmlFor="filtered-column-select">Filtered Column</InputLabel>
                                <Select
                                    className="toolbar-select filtered-column-input"
                                    disabled={state.inProgress}
                                    value={state.filteredColumn}
                                    onChange={(evt) => state.filteredColumn = evt.target.value as string}
                                    inputProps={{ id: "filtered-column-select" }}>

                                    <MenuItem value="0">[Not Selected]</MenuItem>
                                    {DurableOrchestrationStatusFields.map(col => {
                                        return (<MenuItem key={col} value={col}>{col}</MenuItem>);
                                    })}

                                </Select>
                            </FormControl>
                            <FormControl className="toolbar-grid2-item1-select">
                                <InputLabel htmlFor="filter-operator-select">Filter Operator</InputLabel>
                                <Select
                                    className="toolbar-select"
                                    disabled={state.inProgress}
                                    value={state.filterOperator}
                                    onChange={(evt) => state.filterOperator = evt.target.value as number}
                                    inputProps={{ id: "filter-operator-select" }}>
                                    <MenuItem value={0}>Equals</MenuItem>
                                    <MenuItem value={1}>Starts With</MenuItem>
                                    <MenuItem value={2}>Contains</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} className="toolbar-grid2-item2">
                            <TextField
                                className="filter-value-input"
                                label="Filter Value"
                                InputLabelProps={{ shrink: true }}
                                placeholder="[some text or 'null']"
                                disabled={state.filteredColumn === '0' || state.inProgress}
                                value={state.filterValue}
                                onChange={(evt) => state.filterValue = evt.target.value as string}
                                onBlur={() => state.applyFilterValue()}
                                onKeyPress={this.handleKeyPress}
                            />
                        </Grid>
                    </Grid>

                    <RadioGroup
                        value={state.showEntityType}
                        onChange={(evt) => state.showEntityType = (evt.target as HTMLInputElement).value}
                    >
                        <FormControlLabel                            
                            className="entity-type-radio"
                            disabled={state.inProgress}
                            value={ShowEntityTypeEnum[ShowEntityTypeEnum.ShowBoth]}
                            control={<Radio />}
                            label={<Typography variant="subtitle2">Show both</Typography>}
                        />
                        <FormControlLabel
                            className="entity-type-radio"
                            disabled={state.inProgress}
                            value={ShowEntityTypeEnum[ShowEntityTypeEnum.OrchestrationsOnly]}
                            control={<Radio />}
                            label={<Typography variant="subtitle2">Orchestrations only</Typography>}
                        />
                        <FormControlLabel
                            className="entity-type-radio"
                            disabled={state.inProgress}
                            value={ShowEntityTypeEnum[ShowEntityTypeEnum.DurableEntitiesOnly]}
                            control={<Radio />}
                            label={<Typography variant="subtitle2">Durable Entities only</Typography>}
                        />
                    </RadioGroup>

                    <Typography style={{ flex: 1 }} />

                    <Grid container className="toolbar-grid3">
                        <Grid item xs={12}>
                            <FormControl className="form-control-float-right">
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
                        </Grid>
                        <Grid item xs={12} className="toolbar-grid3-item2">
                            <Button
                                className="refresh-button form-control-float-right"
                                variant="outlined"
                                color="default"
                                size="large"
                                onClick={() => state.reloadOrchestrations()}
                            >
                                <RefreshIcon />
                            </Button>
                        </Grid>
                    </Grid>

                </Toolbar>

                <FormHelperText className="items-count-label">
                    {!!state.orchestrations.length ? `${state.orchestrations.length} items shown`: ''}
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
                        {DurableOrchestrationStatusFields
                            // hiding artificial 'lastEvent' column, when not used
                            .filter(f => state.showLastEventColumn ? true : f !== 'lastEvent')
                            .map(col => {
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
                            })
                        }
                    </TableRow>
                </TableHead>
                <TableBody>
                    {state.orchestrations.map(orchestration => {

                        const cellStyle = { verticalAlign: 'top' };
                        return (
                            <TableRow
                                key={orchestration.instanceId}
                                className={"runtime-status-" + orchestration.runtimeStatus.toString().toLowerCase()}
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
                                {state.showLastEventColumn && (<TableCell style={cellStyle}>
                                    {orchestration.lastEvent}
                                </TableCell>)}
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={JSON.stringify(orchestration.input)}
                                    />
                                </TableCell>
                                <TableCell className="output-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={JSON.stringify(orchestration.output)}
                                    />
                                </TableCell>
                                <TableCell className="output-cell" style={cellStyle}>
                                    <InputBase
                                        className="long-text-cell-input"
                                        multiline fullWidth rowsMax={5} readOnly
                                        value={JSON.stringify(orchestration.customStatus)}
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
}
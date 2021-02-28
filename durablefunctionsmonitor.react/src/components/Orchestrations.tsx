import * as React from 'react';
import { action } from 'mobx'
import { observer } from 'mobx-react';
import moment from 'moment';

import {
    AppBar, Box, Button, Checkbox, FormControl, FormControlLabel, FormHelperText, Grid, IconButton, InputBase,
    InputLabel, Link, LinearProgress, MenuItem, Paper, Select,
    Table, TableBody, TableCell, TableHead, TableRow, TableSortLabel, Tab, Tabs, TextField, Toolbar, Typography,
    Radio, RadioGroup
} from '@material-ui/core';

import { KeyboardDateTimePicker } from '@material-ui/pickers';

import CloseIcon from '@material-ui/icons/Close';
import RefreshIcon from '@material-ui/icons/Refresh';
import CancelOutlinedIcon from '@material-ui/icons/CancelOutlined';

import { XYPlot, XAxis, YAxis, DiscreteColorLegend, VerticalRectSeries, Highlight } from 'react-vis';

import './Orchestrations.css';

import { IBackendClient } from '../services/IBackendClient';
import { DateTimeHelpers } from '../DateTimeHelpers';
import { DurableOrchestrationStatusFields } from '../states/DurableOrchestrationStatus';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationLink } from './OrchestrationLink';
import { OrchestrationsState, ShowEntityTypeEnum, ResultsTabEnum } from '../states/OrchestrationsState';
import { ResultsListTabState } from '../states/ResultsListTabState';
import { ResultsGanttDiagramTabState } from '../states/ResultsGanttDiagramTabState';
import { SaveAsSvgButton, getStyledSvg } from './SaveAsSvgButton';

import { CustomTabStyle, RuntimeStatusToStyle } from '../theme';
import { ResultsHistogramTabState } from 'src/states/ResultsHistogramTabState';

const MaxJsonLengthToShow = 1024;

// Orchestrations view
@observer
export class Orchestrations extends React.Component<{ state: OrchestrationsState }> {

    componentDidMount() {

        // Triggering initial load
        this.props.state.loadOrchestrations();

        // Doing a simple infinite scroll
        document.addEventListener('scroll', (evt) => {

            const state = this.props.state;

            if (state.selectedTabIndex !== ResultsTabEnum.List ) {
                return;
            }

            const scrollingElement = (evt.target as Document).scrollingElement;
            if (!scrollingElement) { 
                return;
            }

            const scrollPos = scrollingElement.scrollHeight - window.innerHeight - scrollingElement.scrollTop;
            const scrollPosThreshold = 100;

            if (scrollPos < scrollPosThreshold) {
                state.loadOrchestrations();
            }
        });

        // Doing zoom reset
        document.addEventListener('keydown', (evt: any) => {

            const state = this.props.state;
            if (state.selectedTabIndex === ResultsTabEnum.Histogram && !!evt.ctrlKey && evt.keyCode === 90) {

                const histogramState = state.selectedTabState as ResultsHistogramTabState;
                histogramState.resetZoom();
            }
        });
    }

    render(): JSX.Element {
        const state = this.props.state;
        const listState = state.selectedTabState as ResultsListTabState;

        return (<>
            
            <AppBar color="inherit" position="static" className="top-appbar">

                {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

                <Toolbar variant="dense" className="top-toolbar">

                    <Grid container className="toolbar-grid1">
                        <Grid item xs={12}>

                            <KeyboardDateTimePicker
                                className="from-input"
                                style={{ marginLeft: 10 }}
                                ampm={false}
                                autoOk={true}
                                label="From &nbsp;&nbsp; (UTC)"
                                invalidDateMessage=""
                                format={"YYYY-MM-DD HH:mm:ss"}
                                disabled={state.inProgress}
                                value={state.timeFrom}
                                onChange={(t) => state.timeFrom = DateTimeHelpers.momentAsUtc(t)}
                                onBlur={() => state.applyTimeFrom()}
                                onAccept={() => state.applyTimeFrom()}
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

                            {state.timeTillEnabled ? (
                                <KeyboardDateTimePicker
                                    className="till-input"
                                    ampm={false}
                                    autoOk={true}
                                    label="(UTC)"
                                    invalidDateMessage=""
                                    format={"YYYY-MM-DD HH:mm:ss"}
                                    disabled={state.inProgress}
                                    value={state.timeTill}
                                    onChange={(t) => state.timeTill = DateTimeHelpers.momentAsUtc(t)}
                                    onBlur={() => state.applyTimeTill()}
                                    onAccept={() => state.applyTimeTill()}
                                    onKeyPress={this.handleKeyPress}
                                />
                            ) : (
                                <TextField
                                    className="till-input"
                                    label="(UTC)"
                                    placeholder="[Now]"
                                    InputLabelProps={{ shrink: true }}
                                    type="text"
                                    disabled={true}
                                />
                            )}                        
                            
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
                            label={<Typography color="textPrimary" variant="subtitle2">Show both</Typography>}
                        />
                        <FormControlLabel
                            className="entity-type-radio"
                            disabled={state.inProgress}
                            value={ShowEntityTypeEnum[ShowEntityTypeEnum.OrchestrationsOnly]}
                            control={<Radio />}
                            label={<Typography color="textPrimary" variant="subtitle2">Orchestrations only</Typography>}
                        />
                        <FormControlLabel
                            className="entity-type-radio"
                            disabled={state.inProgress}
                            value={ShowEntityTypeEnum[ShowEntityTypeEnum.DurableEntitiesOnly]}
                            control={<Radio />}
                            label={<Typography color="textPrimary" variant="subtitle2">Durable Entities only</Typography>}
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
                                onClick={() => state.inProgress ? state.cancel() : state.reloadOrchestrations()}
                            >
                                {state.inProgress ? (<CancelOutlinedIcon />) : (<RefreshIcon />)}
                            </Button>
                        </Grid>
                    </Grid>

                </Toolbar>
            </AppBar>

            <AppBar color="inherit" position="static">
                <Tabs className="tab-buttons" value={state.selectedTabIndex} onChange={(ev: React.ChangeEvent<{}>, val) => state.selectedTabIndex = val}>

                    <Tab className="tab-buttons" disabled={state.inProgress} label={<Typography color="textPrimary" variant="subtitle2">List</Typography>} />
                    <Tab className="tab-buttons" disabled={state.inProgress} label={<Typography color="textPrimary" variant="subtitle2">Time Histogram</Typography>} />
                    <Tab className="tab-buttons" disabled={state.inProgress} label={<Typography color="textPrimary" variant="subtitle2">Gantt Chart</Typography>} />

                </Tabs>
            </AppBar>

            {state.selectedTabIndex === ResultsTabEnum.List && (<>

                <FormHelperText className="items-count-label">
                    {!!listState.orchestrations.length && (<>
                        {`${listState.orchestrations.length} items shown`}
                        {!!listState.hiddenColumns.length && (<>

                            {`, ${listState.hiddenColumns.length} columns hidden `}

                            (<Link className="unhide-button"
                                component="button"
                                variant="inherit"
                                onClick={() => listState.unhide()}
                            >
                                unhide
                            </Link>)
                        </>)}
                    </>)}
                </FormHelperText>

                <Paper elevation={0} >
                    {!!listState.orchestrations.length ? this.renderTable(listState, state.showLastEventColumn, state.backendClient) : this.renderEmptyTable()}
                </Paper>

                {state.inProgress && !!listState.orchestrations.length ? (<LinearProgress />) : (<Box height={4} />)}
                
            </>)}

            {state.selectedTabIndex === ResultsTabEnum.Histogram && this.renderHistogram(state.selectedTabState as ResultsHistogramTabState) }
            
            {state.selectedTabIndex === ResultsTabEnum.Gantt && this.renderGanttChart(state, state.selectedTabState as ResultsGanttDiagramTabState)}
                
            <Toolbar variant="dense" />
            
            <ErrorMessage state={this.props.state} />
            
        </>);
    }

    private renderHistogram(histogramState: ResultsHistogramTabState): JSX.Element {

        const typeNames = Object.keys(histogramState.histograms).sort();

        return (<>

            <FormHelperText className="items-count-label">
                {`${histogramState.numOfInstancesShown} items shown`}

                {histogramState.zoomedIn && (<>

                    {', '}
                    <Link className="unhide-button"
                        component="button"
                        variant="inherit"
                        onClick={() => histogramState.resetZoom()}
                    >
                        reset zoom (Ctrl+Z)
                        </Link>
                </>)}

            </FormHelperText>

            <XYPlot
                width={window.innerWidth - 40} height={window.innerHeight - 400}
                xType="time"
                stackBy="y"
                margin={{ left: 80, right: 10, top: 20 }}
            >
                {!!histogramState.numOfInstancesShown && (
                    <YAxis tickTotal={7} />
                )}
                <XAxis tickTotal={7} tickFormat={t => this.formatTimeTick(t)} />

                {typeNames.map(typeName => (<VerticalRectSeries
                    key={typeName}
                    stroke="white"
                    color={this.getColorCodeForInstanceType(typeName)}
                    data={histogramState.histograms[typeName]}
                />))}

                {!!histogramState.numOfInstancesShown && (

                    <Highlight
                        color="#829AE3"
                        drag
                        enableY={false}

                        onDragEnd={(area) => {
                            if (!!area) {
                                histogramState.applyZoom(area.left, area.right);
                            }
                        }}
                    />
                )}

            </XYPlot>

            <DiscreteColorLegend className="histogram-legend"
                colors={typeNames.map(typeName => this.getColorCodeForInstanceType(typeName))}
                items={typeNames}
                orientation="horizontal"
            />

        </>);
    }

    private renderGanttChart(state: OrchestrationsState, ganttState: ResultsGanttDiagramTabState): JSX.Element {

        if (!ganttState.rawHtml) {
            return null;
        }

        return (<>

            <div
                className="raw-html-div"
                style={CustomTabStyle}
                dangerouslySetInnerHTML={{ __html: getStyledSvg(ganttState.rawHtml) }}
            />

            <Toolbar variant="dense">
                <TextField
                    label="mermaid diagram code (for your reference)"
                    value={ganttState.diagramCode}
                    margin="normal"
                    InputProps={{ readOnly: true }}
                    InputLabelProps={{ shrink: true }}
                    variant="outlined"
                    fullWidth
                    multiline
                    rowsMax={4}
                />

                <Box width={20} />

                <SaveAsSvgButton
                    svg={getStyledSvg(ganttState.rawHtml)}
                    fileName={`gantt-chart-${state.timeFrom.format('YYYY-MM-DD-HH-mm-ss')}-${state.timeTill.format('YYYY-MM-DD-HH-mm-ss')}`}
                    inProgress={state.inProgress}
                    backendClient={state.backendClient}
                />

            </Toolbar>
        </>);
    }

    private renderEmptyTable(): JSX.Element {
        return (
            <Typography variant="h5" className="empty-table-placeholder" >
                This list is empty
            </Typography>
        );
    }

    private renderTable(results: ResultsListTabState, showLastEventColumn: boolean, backendClient: IBackendClient): JSX.Element {

        const visibleColumns = DurableOrchestrationStatusFields
            // hiding artificial 'lastEvent' column, when not used
            .filter(f => showLastEventColumn ? true : f !== 'lastEvent');

        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {visibleColumns.map(col => {

                            const onlyOneVisibleColumnLeft = visibleColumns.length <= results.hiddenColumns.length + 1;

                            return !results.hiddenColumns.includes(col) && (
                                <TableCell key={col}
                                    onMouseEnter={() => results.columnUnderMouse = col}
                                    onMouseLeave={() => results.columnUnderMouse = ''}
                                >
                                    <TableSortLabel
                                        active={results.orderBy === col}
                                        direction={results.orderByDirection}
                                        onClick={() => results.orderBy = col}
                                    >
                                        {col}
                                    </TableSortLabel>

                                    {results.columnUnderMouse === col && !onlyOneVisibleColumnLeft && (
                                        <IconButton
                                            color="inherit"
                                            size="small"
                                            className="column-hide-button"
                                            onClick={() => results.hideColumn(col)}
                                        >
                                            <CloseIcon />
                                        </IconButton>                                        
                                    )}

                                </TableCell>
                            );
                        })}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {results.orchestrations.map(orchestration => {

                        const rowStyle = RuntimeStatusToStyle(orchestration.runtimeStatus);
                        const cellStyle = { verticalAlign: 'top' };
                        return (
                            <TableRow
                                key={orchestration.instanceId}
                                style={rowStyle}
                            >
                                {!results.hiddenColumns.includes('instanceId') && (
                                    <TableCell className="instance-id-cell" style={cellStyle}>
                                        <OrchestrationLink orchestrationId={orchestration.instanceId} backendClient={backendClient} />
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('name') && (
                                    <TableCell className="name-cell" style={cellStyle}>
                                        {orchestration.name}
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('createdTime') && (
                                    <TableCell className="datetime-cell" style={cellStyle}>
                                        {orchestration.createdTime}
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('lastUpdatedTime') && (
                                    <TableCell className="datetime-cell" style={cellStyle}>
                                        {orchestration.lastUpdatedTime}
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('runtimeStatus') && (
                                    <TableCell style={cellStyle}>
                                        {orchestration.runtimeStatus}
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('lastEvent') && showLastEventColumn && (
                                    <TableCell style={cellStyle}>
                                        {orchestration.lastEvent}
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('input') && (
                                    <TableCell className="long-text-cell" style={cellStyle}>
                                        <InputBase
                                            className="long-text-cell-input"
                                            multiline fullWidth rowsMax={5} readOnly
                                            value={this.renderJson(orchestration.input)}
                                        />
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('output') && (
                                    <TableCell className="output-cell" style={cellStyle}>
                                        <InputBase
                                            className="long-text-cell-input"
                                            multiline fullWidth rowsMax={5} readOnly
                                            value={this.renderJson(orchestration.output)}
                                        />
                                    </TableCell>
                                )}
                                {!results.hiddenColumns.includes('customStatus') && (
                                    <TableCell className="output-cell" style={cellStyle}>
                                        <InputBase
                                            className="long-text-cell-input"
                                            multiline fullWidth rowsMax={5} readOnly
                                            value={this.renderJson(orchestration.customStatus)}
                                        />
                                    </TableCell>
                                )}
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    private getColorCodeForInstanceType(instanceType: string): string {

        // Taking hash out of input string (reversed, to make names like 'func1', 'func2' etc. look different)
        var hashCode = 0;
        for (var i = instanceType.length - 1; i >= 0; i--) {
            hashCode = ((hashCode << 5) - hashCode) + instanceType.charCodeAt(i);
            // Convert to positive 32-bit integer
            hashCode &= 0x7FFFFFFF;
        }

        // min 6 hex digits
        hashCode |= 0x100000;

        // Not too white
        hashCode &= 0xFFFFEF;

        return '#' + hashCode.toString(16);
    }

    private formatTimeTick(t: Date) {

        const m = moment(t).utc();
        const timeRange = this.props.state.timeTill.valueOf() - this.props.state.timeFrom.valueOf();

        if (timeRange > 5 * 86400 * 1000) {
            return m.format('YYYY-MM-DD');
        }

        if (timeRange > 86400 * 1000) {
            return m.format('YYYY-MM-DD HH:mm');
        }

        if (timeRange > 10000) {

            return m.second() === 0 ? m.format('HH:mm') : m.format('HH:mm:ss');
        }

        return (m.millisecond() === 0) ? m.format('HH:mm:ss') : m.format(':SSS');
    }

    @action.bound
    private handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            // Otherwise the event will bubble up and the form will be submitted
            event.preventDefault();

            this.props.state.reloadOrchestrations();
        }
    }

    private renderJson(json: any): string {

        const result = JSON.stringify(json);

        return result.length > MaxJsonLengthToShow ? `[${result.length} symbols long JSON]` : result;
    }
}
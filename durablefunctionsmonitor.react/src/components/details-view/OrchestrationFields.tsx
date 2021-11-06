import * as React from 'react';
import { observer } from 'mobx-react';

import {
    AppBar, FormControl, Grid, InputLabel, Link, MenuItem, Select, Table, TableBody,
    TableCell, TableHead, TableRow, TextField, Toolbar, Typography
} from '@material-ui/core';

import { FilterOperatorEnum } from '../../states/FilterOperatorEnum';
import { OrchestrationDetailsState } from '../../states/details-view/OrchestrationDetailsState';
import { HistoryEventFields, HistoryEvent } from '../../states/DurableOrchestrationStatus';
import { OrchestrationLink } from '../OrchestrationLink';
import { DfmContextType } from '../../DfmContext';
import { RuntimeStatusToStyle } from '../../theme';
import { Theme } from '../../theme';
import { LongJsonDialog } from '../dialogs/LongJsonDialog';

// Fields for detailed orchestration view
@observer
export class OrchestrationFields extends React.Component<{ state: OrchestrationDetailsState }> {

    static contextType = DfmContextType;
    context!: React.ContextType<typeof DfmContextType>;

    componentDidMount() {

        // Doing a simple infinite scroll
        document.addEventListener('scroll', (evt) => {

            const scrollingElement = (evt.target as Document).scrollingElement;
            if (!scrollingElement) {
                return;
            }

            const scrollPos = scrollingElement.scrollHeight - window.innerHeight - scrollingElement.scrollTop;
            const scrollPosThreshold = 50;

            if (scrollPos < scrollPosThreshold) {
                this.props.state.loadHistory();
            }
        });
    }

    render(): JSX.Element {

        const state = this.props.state;

        const totalItems = state.historyTotalCount;
        const details = state.details;
        const history = state.history;
        const itemsShown = history.length;

        const runtimeStatusStyle = RuntimeStatusToStyle(details.runtimeStatus);

        return (<>
            <Grid container className="grid-container">
                <Grid item xs={12} sm={12} md={3} zeroMinWidth className="grid-item">
                    <TextField
                        label="instanceId"
                        value={details.instanceId}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={12} md={3} zeroMinWidth className="grid-item">
                    <TextField
                        label="name"
                        value={details.name}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={4} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label={`createdTime (${this.context.timeZoneName})`}
                        value={this.context.formatDateTimeString(details.createdTime)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={4} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label={`lastUpdatedTime (${this.context.timeZoneName})`}
                        value={this.context.formatDateTimeString(details.lastUpdatedTime)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={4} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="runtimeStatus"
                        value={details.runtimeStatus}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        style={runtimeStatusStyle}
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="input"
                        value={LongJsonDialog.formatJson(details.input)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={8}
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="output"
                        value={LongJsonDialog.formatJson(details.output)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={8}
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="customStatus"
                        value={LongJsonDialog.formatJson(details.customStatus)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={8}
                    />
                </Grid>
            </Grid>

            <AppBar color="inherit" position="static" className="history-appbar">
                <Toolbar >

                    <Typography variant="subtitle2" color="inherit" className="history-toolbar">
                        Execution History
                        (
                            {(!totalItems || totalItems === itemsShown) ? `${itemsShown} items${!totalItems ? ' shown' : ''}` : `${itemsShown} of ${totalItems} items shown`}
                            {(state.filteredColumn !== '0') && (!!state.filterValue) ? `, filtered by ${state.filteredColumn}` : ''}
                        )
                    </Typography>
                    
                    <Typography style={{ flex: 1 }} />

                    <FormControl>
                        <InputLabel htmlFor="history-filtered-column-select">Filtered Column</InputLabel>
                        <Select
                            className="toolbar-select history-filtered-column-input"
                            disabled={state.inProgress}
                            value={state.filteredColumn}
                            onChange={(evt) => state.filteredColumn = evt.target.value as string}
                            inputProps={{ id: "history-filtered-column-select" }}>

                            <MenuItem value="0">[Not Selected]</MenuItem>

                            {HistoryEventFields.map(col => {
                                return (<MenuItem key={col} value={col}>{col}</MenuItem>);
                            })}

                        </Select>
                    </FormControl>
                    
                    <FormControl>

                        <InputLabel htmlFor="history-filter-operator-select">Filter Operator</InputLabel>
                        <Select
                            className="toolbar-select"
                            disabled={state.inProgress}
                            value={state.filterOperator}
                            onChange={(evt) => state.filterOperator = evt.target.value as number}
                            inputProps={{ id: "history-filter-operator-select" }}
                        >
                            <MenuItem value={FilterOperatorEnum.Equals}>Equals</MenuItem>
                            <MenuItem value={FilterOperatorEnum.StartsWith}>Starts With</MenuItem>
                            <MenuItem value={FilterOperatorEnum.Contains}>Contains</MenuItem>
                            <MenuItem value={FilterOperatorEnum.In}>In</MenuItem>
                            <MenuItem value={FilterOperatorEnum.NotEquals}>Not Equals</MenuItem>
                            <MenuItem value={FilterOperatorEnum.NotStartsWith}>Not Starts With</MenuItem>
                            <MenuItem value={FilterOperatorEnum.NotContains}>Not Contains</MenuItem>
                            <MenuItem value={FilterOperatorEnum.NotIn}>Not In</MenuItem>
                        </Select>

                    </FormControl>

                    <TextField
                        size="small"
                        className="history-filter-value-input"
                        label="Filter Value"
                        InputLabelProps={{ shrink: true }}
                        placeholder={[FilterOperatorEnum.In, FilterOperatorEnum.NotIn].includes(state.filterOperator) ? `[comma-separated or JSON array]` : `[some text or 'null']`}
                        disabled={state.filteredColumn === '0' || state.inProgress}
                        value={state.filterValue}
                        onChange={(evt) => state.filterValue = evt.target.value as string}
                        onBlur={() => state.applyFilterValue()}
                        onKeyPress={(evt) => this.handleKeyPress(evt as any)}
                    />

                </Toolbar>            
            </AppBar>
            
            {!!history.length && this.renderTable(history)}

            <LongJsonDialog state={state.longJsonDialogState} />

        </>);
    }

    private renderEventLink(event: HistoryEvent): JSX.Element | string {

        const state = this.props.state;
        const functionName = event.Name;

        if (!!event.SubOrchestrationId) {
            return (<OrchestrationLink orchestrationId={event.SubOrchestrationId}
                title={functionName}
                backendClient={state.backendClient}
            />);
        }

        if (!!state.functionNames[functionName]) {
            
            // Showing link to sources
            return (<Link className="link-with-pointer-cursor"
                color={Theme.palette.type === 'dark' ? 'inherit' : 'primary'}
                onClick={() => { state.gotoFunctionCode(functionName) }}
            >
                {functionName}
            </Link>);
        }

        return functionName;
    }

    private renderTable(events: HistoryEvent[]): JSX.Element {

        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {HistoryEventFields.map(col => {
                            return <TableCell key={col}>

                                {col}

                                {['Timestamp', 'ScheduledTime'].includes(col) && (<span className="time-zone-name-span">({this.context.timeZoneName})</span>)}

                            </TableCell>;
                        })}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {events.map((event: HistoryEvent, index: number) => {

                        const cellStyle = { verticalAlign: 'top' };
                        return (
                            <TableRow key={index}>
                                <TableCell style={cellStyle}>
                                    {this.context.formatDateTimeString(event.Timestamp)}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {event.EventType}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {event.EventId}
                                </TableCell>
                                <TableCell className="name-cell" style={cellStyle}>
                                    {this.renderEventLink(event)}
                                </TableCell>
                                <TableCell style={cellStyle}>
                                    {this.context.formatDateTimeString(event.ScheduledTime)}
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    {LongJsonDialog.renderJson(event.Result, `${event.EventType} / ${event.Name} / ${HistoryEventFields[5]}`, this.props.state.longJsonDialogState)}
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    {LongJsonDialog.renderJson(event.Details, `${event.EventType} / ${event.Name} / ${HistoryEventFields[6]}`, this.props.state.longJsonDialogState)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }

    private handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Enter') {
            // Otherwise the event will bubble up and the form will be submitted
            event.preventDefault();

            this.props.state.reloadHistory();
        }
    }
}
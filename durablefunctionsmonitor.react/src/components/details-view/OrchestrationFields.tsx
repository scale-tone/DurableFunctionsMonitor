import * as React from 'react';
import { observer } from 'mobx-react';

import {
    FormHelperText, Grid, Link, Table, TableBody, TableCell, TableHead, TableRow, TextField
} from '@material-ui/core';

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

            <FormHelperText className="history-events-count-label">
                historyEvents: { (!totalItems || totalItems === itemsShown) ? `${itemsShown} items${!totalItems ? ' shown' : ''}` : `${itemsShown} of ${totalItems} items shown` }
            </FormHelperText>

            {!!history.length && this.renderTable(history)}

            <LongJsonDialog state={state.longJsonDialogState} />

        </>);
    }

    private getFunctionName(event: HistoryEvent): string {

        if (!!event.Name) {
            return event.Name;
        }

        return event.FunctionName ?? '';
    }

    private renderEventLink(event: HistoryEvent): JSX.Element | string {

        const state = this.props.state;
        const functionName = this.getFunctionName(event);

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
                                    {LongJsonDialog.renderJson(event.Result, `${event.EventType} / ${this.getFunctionName(event)} / ${HistoryEventFields[5]}`, this.props.state.longJsonDialogState)}
                                </TableCell>
                                <TableCell className="long-text-cell" style={cellStyle}>
                                    {LongJsonDialog.renderJson(event.Details, `${event.EventType} / ${this.getFunctionName(event)} / ${HistoryEventFields[6]}`, this.props.state.longJsonDialogState)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    }
}
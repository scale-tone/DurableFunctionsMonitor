import * as React from 'react';
import { observer } from 'mobx-react';

import {
    FormHelperText, Grid, InputBase, Table, TableBody, TableCell, TableHead, TableRow, Typography, TextField
} from '@material-ui/core';

import { DurableOrchestrationStatus, HistoryEventFields } from '../states/DurableOrchestrationStatus';

// Fields for detailed orchestration view
@observer
export class OrchestrationFields extends React.Component<{ details: DurableOrchestrationStatus }> {

    render(): JSX.Element {
        const details = this.props.details;

        return (<>
            <Grid container className="grid-container">
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
                <Grid item xs={12} sm={6} md={2} zeroMinWidth className="grid-item">
                    <TextField
                        label="createdTime"
                        value={details.createdTime}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
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
                        InputLabelProps={{ shrink: true }}
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
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        className={!!details.runtimeStatus ? "runtime-status-" + details.runtimeStatus.toLowerCase() : ""}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3} zeroMinWidth className="grid-item">
                    <TextField
                        label="customStatus"
                        value={JSON.stringify(details.customStatus)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="input"
                        value={JSON.stringify(details.input, null, 3)}
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
                        value={JSON.stringify(details.output, null, 3)}
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
                historyEvents: {!!details.historyEvents ? details.historyEvents.length : 0} items
            </FormHelperText>

            {this.renderTable(details.historyEvents)}

        </>);
    }

    private renderEmptyTable(): JSX.Element {
        return (
            <Typography variant="h5" className="empty-table-placeholder" >
                This list is empty
            </Typography>
        );
    }

    private renderTable(events: Array<any> | undefined): JSX.Element {

        if (!events || !events.length) {
            return this.renderEmptyTable();
        }

        return (
            <Table size="small">
                <TableHead>
                    <TableRow>
                        {HistoryEventFields.map(col => {
                            return <TableCell key={col}>{col}</TableCell>;
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
                                <TableCell style={cellStyle}>
                                    {event.EventType}
                                </TableCell>
                                <TableCell className="name-cell" style={cellStyle}>
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
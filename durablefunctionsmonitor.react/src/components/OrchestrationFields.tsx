import * as React from 'react';
import { observer } from 'mobx-react';

import {
    FormHelperText, Grid, InputBase, Table, TableBody, TableCell, TableHead, TableRow, Typography, TextField
} from '@material-ui/core';

import { DurableOrchestrationStatus, HistoryEventFields, HistoryEvent } from '../states/DurableOrchestrationStatus';
import { IBackendClient } from '../services/IBackendClient';
import { OrchestrationLink } from './OrchestrationLink';
import { RuntimeStatusToStyle } from '../theme';

// Fields for detailed orchestration view
@observer
export class OrchestrationFields extends React.Component<{ details: DurableOrchestrationStatus, history: HistoryEvent[], showMoreHistory: () => void, backendClient: IBackendClient }> {

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
                this.props.showMoreHistory();
            }
        });
    }

    render(): JSX.Element {
        const details = this.props.details;
        const history = this.props.history;

        const totalItems = !details.historyEvents ? 0 : details.historyEvents.length;
        const itemsShown = !history ? 0 : history.length;

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
                        label="createdTime"
                        value={details.createdTime}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>
                <Grid item xs={12} sm={4} md={2} zeroMinWidth className="grid-item">
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
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="customStatus"
                        value={JSON.stringify(details.customStatus, null, 3)}
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
                historyEvents: { totalItems === itemsShown ? `${itemsShown} items` : `${itemsShown} of ${totalItems} items shown` }
            </FormHelperText>

            {!!history && !!history.length && this.renderTable(history)}

        </>);
    }

    private renderTable(events: HistoryEvent[]): JSX.Element {

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
                    {events.map((event: HistoryEvent, index: number) => {

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

                                    {!!event.SubOrchestrationId ?
                                        (<OrchestrationLink
                                            orchestrationId={event.SubOrchestrationId}
                                            title={event.FunctionName}
                                            backendClient={this.props.backendClient} />)
                                        :
                                        (event.Name ?? event.FunctionName)
                                    }

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
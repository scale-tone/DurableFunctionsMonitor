import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Grid, TextField
} from '@material-ui/core';

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';

// Fields for detailed durable entity view
@observer
export class DurableEntityFields extends React.Component<{ details: DurableOrchestrationStatus }> {

    render(): JSX.Element {
        const details = this.props.details;

        return (<>
            <Grid container className="grid-container">
                <Grid item xs={12} sm={12} md={3} zeroMinWidth className="grid-item">
                    <TextField
                        label="entityId.name"
                        value={details.entityId.name}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                    />
                </Grid>

                <Grid item xs={12} sm={6} md={3} zeroMinWidth className="grid-item">
                    <TextField
                        label="entityId.key"
                        value={details.entityId.key}
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
                
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="input"
                        value={JSON.stringify(details.input)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={5}
                    />
                </Grid>
                <Grid item xs={12} zeroMinWidth className="grid-item">
                    <TextField
                        label="customStatus"
                        value={JSON.stringify(details.customStatus)}
                        margin="normal"
                        InputProps={{ readOnly: true }}
                        InputLabelProps={{ shrink: true }}
                        variant="outlined"
                        fullWidth
                        multiline
                        rowsMax={5}
                    />
                </Grid>
            </Grid>

        </>);
    }
}
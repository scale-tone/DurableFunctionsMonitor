import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Checkbox, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl,
    FormControlLabel, FormGroup, FormLabel, LinearProgress, Radio, RadioGroup, TextField, Tooltip, Typography
} from '@material-ui/core';

import './PurgeHistoryDialog.css';

import { DateTimeHelpers } from '../DateTimeHelpers';
import { ErrorMessage } from './ErrorMessage';
import { EntityType, RuntimeStatus } from '../states/DurableOrchestrationStatus';
import { PurgeHistoryDialogState } from '../states/PurgeHistoryDialogState';

// Dialog with parameters for purging orchestration instance history
@observer
export class PurgeHistoryDialog extends React.Component<{ state: PurgeHistoryDialogState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <Dialog open={state.dialogOpen} onClose={() => { if (!state.inProgress) state.dialogOpen = false; }}>

                <DialogTitle>Purge Instance History</DialogTitle>

                {state.instancesDeleted === null && (
                    <div>
                        <DialogContent>

                            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

                            <DialogContentText>
                                WARNING: this operation drops instance states from the underlying storage and cannot be undone.

                                {state.entityType === "DurableEntity" && (
                                    <Typography color="error" >
                                        It might as well remove Durable Entities, that are still active.
                                        Ensure that you specify the correct time frame!
                                    </Typography>
                                )}

                            </DialogContentText>

                            <FormControl className="purge-history-statuses" disabled={state.inProgress} fullWidth>
                                <FormLabel>Apply to:</FormLabel>
                                <RadioGroup row
                                    value={state.entityType}
                                    onChange={(evt) => state.entityType = (evt.target as HTMLInputElement).value as EntityType}
                                >
                                    <FormControlLabel
                                        disabled={state.inProgress}
                                        value={"Orchestration"}
                                        control={<Radio />}
                                        label="Orchestrations"
                                    />
                                    <FormControlLabel
                                        disabled={state.inProgress}
                                        value={"DurableEntity"}
                                        control={<Radio />}
                                        label="Durable Entities"
                                    />
                                </RadioGroup>
                            </FormControl>

                            <TextField
                                className="purge-history-from-input"
                                label="From (UTC)"
                                type="datetime-local"
                                InputLabelProps={{ shrink: true }}
                                disabled={state.inProgress}
                                value={DateTimeHelpers.formatDateTime(state.timeFrom)}
                                onChange={(evt) => { state.timeFrom = DateTimeHelpers.getDateTimeValue(evt); }}
                            />

                            <TextField
                                className="purge-history-till-input"
                                label="Till (UTC)"
                                type="datetime-local"
                                InputLabelProps={{ shrink: true }}
                                disabled={state.inProgress}
                                value={DateTimeHelpers.formatDateTime(state.timeTill)}
                                onChange={(evt) => { state.timeTill = DateTimeHelpers.getDateTimeValue(evt); }}
                            />

                            <FormControl className="purge-history-statuses" disabled={state.inProgress}>
                                <FormLabel>With the following status:</FormLabel>

                                {state.entityType === "Orchestration" && (
                                    <FormGroup row>
                                        <RuntimeStatusCheckbox state={state} runtimeStatus="Completed" />
                                        <RuntimeStatusCheckbox state={state} runtimeStatus="Failed" />
                                        <RuntimeStatusCheckbox state={state} runtimeStatus="Terminated" />
                                    </FormGroup>
                                )}

                                {state.entityType === "DurableEntity" && (
                                    <FormGroup row>
                                        <Tooltip title="Durable Entities are always in 'Running' state">
                                            <FormControlLabel
                                                control={<Checkbox
                                                    checked={true} />}
                                                label="Running"
                                                disabled={true}
                                            />
                                        </Tooltip>
                                    </FormGroup>
                                )}
                            </FormControl>

                            <ErrorMessage state={state} />

                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => state.dialogOpen = false} disabled={state.inProgress} color="primary">
                                Cancel
                            </Button>
                            <Button onClick={() => state.purgeHistory()} disabled={!state.isValid || state.inProgress} color="secondary">
                                Purge
                            </Button>
                        </DialogActions>
                    </div>
                )}

                {state.instancesDeleted !== null && (
                    <div>
                        <DialogContent>
                            <DialogContentText className="success-message">
                                {state.instancesDeleted} instances were deleted.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => state.dialogOpen = false} color="primary">
                                Close
                            </Button>
                        </DialogActions>
                    </div>
                )}

            </Dialog>
        );
    }
}

@observer
class RuntimeStatusCheckbox extends React.Component<{ state: PurgeHistoryDialogState, runtimeStatus: RuntimeStatus }> {

    render(): JSX.Element {
        const state = this.props.state;
        const runtimeStatus = this.props.runtimeStatus;

        return (
            <FormControlLabel
                control={<Checkbox
                    checked={state.getStatusIncluded(runtimeStatus)}
                    onChange={(evt) => state.setStatusIncluded(runtimeStatus, evt.target.checked)} />}
                label={runtimeStatus}
            />
        );
    }
}
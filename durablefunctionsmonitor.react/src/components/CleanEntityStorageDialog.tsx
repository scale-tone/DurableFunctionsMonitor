import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Checkbox, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl,
    FormControlLabel, FormGroup, FormLabel, LinearProgress, Radio, RadioGroup, Tooltip, Typography
} from '@material-ui/core';

import './CleanEntityStorageDialog.css';

import { ErrorMessage } from './ErrorMessage';
import { CleanEntityStorageDialogState } from '../states/CleanEntityStorageDialogState';

// Dialog with parameters for cleaning entity storage
@observer
export class CleanEntityStorageDialog extends React.Component<{ state: CleanEntityStorageDialogState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <Dialog open={state.dialogOpen} onClose={() => { if (!state.inProgress) state.dialogOpen = false; }}>

                <DialogTitle>Clean Entity Storage</DialogTitle>

                {!state.response && (<>
                    <DialogContent>

                        {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

                        <FormControl className="purge-history-statuses" disabled={state.inProgress}>
                            <FormGroup row>

                                <FormControlLabel control={<Checkbox
                                    checked={state.removeEmptyEntities}
                                    onChange={(evt) => state.removeEmptyEntities = evt.target.checked} />}
                                    label="Remove Empty Entities"
                                />

                                <FormControlLabel control={<Checkbox
                                    checked={state.releaseOrphanedLocks}
                                    onChange={(evt) => state.releaseOrphanedLocks = evt.target.checked} />}
                                    label="Release Orphaned Locks"
                                />
                                
                            </FormGroup>
                        </FormControl>

                        <ErrorMessage state={state} />

                    </DialogContent>

                    <DialogActions>
                        <Button onClick={() => state.dialogOpen = false} disabled={state.inProgress} color="primary">
                            Cancel
                        </Button>
                        <Button onClick={() => state.clean()} disabled={!state.isValid || state.inProgress} color="secondary">
                            Clean
                        </Button>
                    </DialogActions>
                </>)}

                {!!state.response && (<>
                    <DialogContent>
                        <DialogContentText className="success-message">
                            {state.response.numberOfEmptyEntitiesRemoved} empty entities removed. 
                        </DialogContentText>
                        <DialogContentText className="success-message">
                            {state.response.numberOfOrphanedLocksRemoved} orphaned locks removed.
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => state.dialogOpen = false} color="primary">
                            Close
                        </Button>
                    </DialogActions>
                </>)}

            </Dialog>
        );
    }
}
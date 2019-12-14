import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
} from '@material-ui/core';

import { OrchestrationDetailsState } from '../states/OrchestrationDetailsState';

// Buttons for detailed durable entity view
@observer
export class DurableEntityButtons extends React.Component<{ state: OrchestrationDetailsState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (<>

            {this.renderDialogs(state)}

            <Button variant="outlined" color="primary" size="large" onClick={() => state.purgeConfirmationOpen = true}>
                Purge
            </Button>            
        </>);
    }

    private renderDialogs(state: OrchestrationDetailsState): JSX.Element {
        return (<>

            <Dialog
                open={state.purgeConfirmationOpen}
                onClose={() => state.purgeConfirmationOpen = false}
            >
                <DialogTitle>Confirm Purge</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        You're about to purge entity '{state.orchestrationId}'. This operation drops entity state from the underlying storage and cannot be undone. Are you sure?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => state.purgeConfirmationOpen = false} color="primary" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={() => state.purge()} color="secondary">
                        Yes, purge
                    </Button>
                </DialogActions>
            </Dialog>

        </>);
    }
}
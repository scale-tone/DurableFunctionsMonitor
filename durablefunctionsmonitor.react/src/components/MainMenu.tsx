import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, LinearProgress,
    Menu, MenuItem, TextField
} from '@material-ui/core';

import MenuIcon from '@material-ui/icons/Menu';

import { ErrorMessage } from './ErrorMessage';
import { MainMenuState } from '../states/MainMenuState';

// Main Menu view
@observer
export class MainMenu extends React.Component<{ state: MainMenuState }> {

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <div>

                <IconButton color="inherit"
                    onClick={evt => state.menuAnchorElement = evt.currentTarget}
                >
                    <MenuIcon/>
                </IconButton>

                <Menu
                    anchorEl={state.menuAnchorElement}
                    keepMounted
                    open={!!state.menuAnchorElement}
                    onClose={() => state.menuAnchorElement = undefined}
                >
                    <MenuItem onClick={() => state.showConnectionParamsDialog()}>Manage Storage Connection Settings</MenuItem>
                </Menu>

                <Dialog
                    open={state.connectionParamsDialogOpen}
                    onClose={() => state.connectionParamsDialogOpen = false}
                >
                    <DialogTitle>Manage Storage Connection Setings</DialogTitle>
                    <DialogContent>

                        {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
                        
                        <DialogContentText>
                            The below values will be saved to host.json and local.settings.json respectively.
                        </DialogContentText>

                        <TextField
                            autoFocus
                            margin="dense"
                            label="Hub Name"
                            fullWidth
                            disabled={state.inProgress}
                            value={state.hubName}
                            onChange={(evt) => state.hubName = evt.target.value as string}
                        />

                        <TextField
                            autoFocus
                            margin="dense"
                            label="Azure Storage Connection String"
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            placeholder={state.isConnectionStringReadonly ? "[Change it via 'AzureWebJobsStorage' env variable]" : ""}
                            disabled={state.inProgress || state.isConnectionStringReadonly}
                            value={state.connectionString}
                            onChange={(evt) => state.connectionString = evt.target.value as string}
                        />

                        <ErrorMessage state={state}/>

                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => state.connectionParamsDialogOpen = false} color="primary">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => state.saveConnectionParams()}
                            disabled={!state.hubName || (!state.isConnectionStringReadonly && !state.connectionString) || state.inProgress}
                            color="secondary"
                        >
                            Save
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        );
    }
}
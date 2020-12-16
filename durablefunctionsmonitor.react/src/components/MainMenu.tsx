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

    componentDidMount() {
        // Querying the backend for connection info and displaying it in window title
        this.props.state.setWindowTitle();
    }

    render(): JSX.Element {
        const state = this.props.state;

        return (<>
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
                <MenuItem onClick={() => state.showConnectionParamsDialog()}>Manage Storage Connection Settings...</MenuItem>
                <MenuItem onClick={() => state.showPurgeHistoryDialog()}>Purge Instance History...</MenuItem>
                <MenuItem onClick={() => state.showCleanEntityStorageDialog()}>Clean Entity Storage...</MenuItem>
            </Menu>

            <Dialog
                open={state.connectionParamsDialogOpen}
                onClose={() => state.connectionParamsDialogOpen = false}
            >
                <DialogTitle>Manage Storage Connection Settings</DialogTitle>
                <DialogContent>

                    {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
                    
                    <DialogContentText>
                        {
                            state.isReadonly ?
                                "Change the below values via your application settings ('DFM_HUB_NAME' and 'AzureWebJobsStorage' respectively)" :
                                "The below values will be saved to local.settings.json file."
                        }
                    </DialogContentText>

                    <TextField
                        autoFocus
                        margin="dense"
                        label="Hub Name"
                        fullWidth
                        disabled={state.inProgress }
                        InputProps={{ readOnly: state.isReadonly }}
                        InputLabelProps={{ shrink: true }}
                        value={state.hubName}
                        onChange={(evt) => state.hubName = evt.target.value as string}
                    />

                    <TextField
                        autoFocus
                        margin="dense"
                        label="Azure Storage Connection String"
                        fullWidth
                        disabled={state.inProgress }
                        InputProps={{ readOnly: state.isReadonly }}
                        InputLabelProps={{ shrink: true }}
                        value={state.connectionString}
                        onChange={(evt) => state.connectionString = evt.target.value as string}
                    />

                    <ErrorMessage state={state}/>

                </DialogContent>
                <DialogActions>
                    <Button onClick={() => state.connectionParamsDialogOpen = false} color="primary">
                        Cancel
                    </Button>

                    {(!state.isReadonly) && (
                        <Button
                            onClick={() => state.saveConnectionParams()}
                            disabled={!state.isDirty || !state.hubName || !state.connectionString || state.inProgress}
                            color="secondary"
                        >
                            Save
                        </Button>
                    )}

                </DialogActions>
            </Dialog>
        </>);
    }
}
import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle, InputBase, Link
} from '@material-ui/core';

const MaxJsonLengthToShow = 512;
const MaxJsonLengthToShowAsLink = 20;

export type LongJsonDialogState = { title?: string, jsonString?: string };

// Dialog to display long JSON strings
@observer
export class LongJsonDialog extends React.Component<{ state: LongJsonDialogState }> {
    
    public static renderJson(jsonObject: any, dialogTitle: string, dialogState: LongJsonDialogState): JSX.Element {

        if (!jsonObject) {
            return null;
        }

        const jsonString = (typeof jsonObject === 'string' ? jsonObject : JSON.stringify(jsonObject));
 
        if (jsonString.length <= MaxJsonLengthToShow) {

            return (<InputBase
                className="long-text-cell-input"
                multiline fullWidth rowsMax={5} readOnly
                value={jsonString}
            />);
        }

        const jsonFormattedString = (typeof jsonObject === 'string' ? jsonObject : JSON.stringify(jsonObject, null, 3));

        return (<Link
            component="button"
            variant="inherit"
            onClick={() => {
                dialogState.title = dialogTitle;
                dialogState.jsonString = jsonFormattedString;
            }}
        >
            {jsonString.substr(0, MaxJsonLengthToShowAsLink)}...
        </Link>)
    }

    render(): JSX.Element {
        const state = this.props.state;

        return (
            <Dialog fullWidth={true} maxWidth="md" open={!!state.jsonString} onClose={() => state.jsonString = ''}>

                <DialogTitle>{state.title}</DialogTitle>

                <DialogContent>
                    <InputBase
                        multiline fullWidth readOnly
                        value={state.jsonString}
                    />                    
                </DialogContent>
                
                <DialogActions>
                    <Button onClick={() => state.jsonString = ''} color="primary">
                        Close
                    </Button>
                </DialogActions>

            </Dialog>
       );
    }
}
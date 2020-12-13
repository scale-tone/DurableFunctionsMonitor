import * as React from 'react';
import { observer } from 'mobx-react';

import {
    AppBar, Box, Button, FormControl, InputLabel, LinearProgress, MenuItem, Paper,
    Select, Tabs, Tab, TextField, Toolbar, Typography
} from '@material-ui/core';

import RefreshIcon from '@material-ui/icons/Refresh';
import SaveIcon from '@material-ui/icons/Save';

import './OrchestrationDetails.css';

import { DurableEntityButtons } from './DurableEntityButtons';
import { DurableEntityFields } from './DurableEntityFields';
import { ErrorMessage } from './ErrorMessage';
import { OrchestrationButtons } from './OrchestrationButtons';
import { OrchestrationDetailsState } from '../states/OrchestrationDetailsState';
import { OrchestrationFields } from './OrchestrationFields';
import { IBackendClient } from '../services/IBackendClient';

// Orchestration Details view
@observer
export class OrchestrationDetails extends React.Component<{ state: OrchestrationDetailsState }> {

    componentDidMount() {

        // Triggering initial load
        this.props.state.loadDetails();
    }
    
    render(): JSX.Element {
        const state = this.props.state;

        return (<>
            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}
           
            <Toolbar variant="dense" className="top-toolbar">

                {state.details.entityType === "Orchestration" && (
                    <OrchestrationButtons state={state} disabled={state.inProgress} />
                )}
                {state.details.entityType === "DurableEntity" && (
                    <DurableEntityButtons state={state} disabled={state.inProgress} />
                )}
                
                <Box width={20} />
                <Typography style={{ flex: 1 }} />

                <FormControl>
                    <InputLabel htmlFor="auto-refresh-select">Auto-refresh</InputLabel>
                    <Select
                        className="toolbar-select"
                        value={state.autoRefresh}
                        onChange={(evt) => state.autoRefresh = evt.target.value as number}
                        inputProps={{ id: 'auto-refresh-select' }}>
                        <MenuItem value={0}>Never</MenuItem>
                        <MenuItem value={1}>Every 1 sec.</MenuItem>
                        <MenuItem value={5}>Every 5 sec.</MenuItem>
                        <MenuItem value={10}>Every 10 sec.</MenuItem>
                    </Select>
                </FormControl>

                <Box width={20} />

                <Button
                    className="details-refresh-button"
                    variant="outlined"
                    color="default"
                    size="large"
                    disabled={state.inProgress}
                    onClick={() => state.loadDetails()}
                >
                    <RefreshIcon />
                </Button>

            </Toolbar>

            {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

            {!!state.tabStates.length && (<>
                <AppBar color="inherit" position="static">
                    <Tabs value={state.selectedTabIndex} onChange={(ev: React.ChangeEvent<{}>, val) => state.selectedTabIndex = val}>
                        <Tab label="Details" disabled={state.inProgress} />
                        {state.tabStates.map(tabState => (
                            <Tab key={tabState.name} label={tabState.name} disabled={state.inProgress} />
                        ))}
                    </Tabs>
                </AppBar>
            </>)}

            {!state.selectedTabIndex && !state.inProgress && state.details.entityType === "Orchestration" &&
                (<OrchestrationFields details={state.details} backendClient={state.backendClient} />)
            }
            {!state.selectedTabIndex && !state.inProgress && state.details.entityType === "DurableEntity" &&
                <DurableEntityFields details={state.details} />
            }

            {!!state.selectedTab && !!state.selectedTab.rawHtml && (<>

                <div className="raw-html-div" dangerouslySetInnerHTML={{ __html: this.getStyledSvg(state.selectedTab.rawHtml) }} />
                
                {state.selectedTab.name === "Sequence Diagram" && (

                    <Toolbar variant="dense">
                        <TextField
                            label="mermaid sequence diagram code (for your reference)"
                            value={state.selectedTab.description}
                            margin="normal"
                            InputProps={{ readOnly: true }}
                            InputLabelProps={{ shrink: true }}
                            variant="outlined"
                            fullWidth
                            multiline
                            rowsMax={4}
                        />

                        <Box width={20} />

                        <SaveAsSvgButton
                            svg={this.getStyledSvg(state.selectedTab.rawHtml)}
                            orchestrationId={state.orchestrationId}
                            inProgress={state.inProgress}
                            backendClient={state.backendClient}
                        />

                    </Toolbar>
                )}
                
            </>)}

            <ErrorMessage state={this.props.state} />
        </>);
    }

    // Appends some styling to SVG code, so it can also be saved as file
    private getStyledSvg(svg: string): string {

        return svg.replace('</style>',
            '.note { stroke: none !important; fill: none !important; } ' +
            '.noteText { font-size: 9px !important; } ' +
            '</style>'
        );
    }
}

class SaveAsSvgButton extends React.Component<{ svg: string, orchestrationId: string, inProgress: boolean, backendClient: IBackendClient }> {

    render(): JSX.Element {

        if (this.props.backendClient.isVsCode) {

            return (
                <Button
                    variant="outlined"
                    color="default"
                    size="large"
                    className="save-svg-button"
                    disabled={this.props.inProgress}
                    onClick={() => this.props.backendClient.call('SaveAs', this.props.orchestrationId + '.svg', this.props.svg)}
                >
                    <div>
                        <SaveIcon />
                        <Typography color="inherit">Save as .SVG</Typography>
                    </div>
                </Button>
            );

        } else {

            return (
                <Button
                    variant="outlined"
                    color="default"
                    size="large"
                    className="save-svg-button"
                    disabled={this.props.inProgress}
                    href={URL.createObjectURL(new Blob([this.props.svg], { type: 'image/svg+xml' }))}
                    download={this.props.orchestrationId + '.svg'}
                >
                    <div>
                        <SaveIcon />
                        <Typography color="inherit">Save as .SVG</Typography>
                    </div>
                </Button>
            );
        }
    }
}
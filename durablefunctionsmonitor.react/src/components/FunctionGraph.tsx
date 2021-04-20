import * as React from 'react';
import { observer } from 'mobx-react';

import { AppBar, Box, Button, LinearProgress, TextField, Toolbar, Typography } from '@material-ui/core';

import './FunctionGraph.css';

import RefreshIcon from '@material-ui/icons/Refresh';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import { ErrorMessage } from './ErrorMessage';
import { FunctionGraphState } from '../states/FunctionGraphState';
import { CustomTabStyle } from '../theme';
import { SaveAsSvgButton, getStyledSvg } from './SaveAsSvgButton';
import { IBackendClient } from '../services/IBackendClient';

// Function Graph view
@observer
export class FunctionGraph extends React.Component<{ state: FunctionGraphState }> {

    componentDidMount() {

        // Triggering initial load
        this.props.state.load();

        // The only way found so far to pass backendClient to node click handlers
        FunctionGraph.backendClient = this.props.state.backendClient;
    }

    componentDidUpdate() {

        const svgElement = document.getElementById('mermaidSvgId');

        console.log(`svgElement is ${svgElement}`);

        if (!svgElement) {
            return;
        }

        this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('function'));
        this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('orchestrator'));
        this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('activity'));
        this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('entity'));
    }
    
    render(): JSX.Element {
        const state = this.props.state;

        return (<>
            <AppBar color="inherit" position="static" className="top-appbar">

                {state.inProgress ? (<LinearProgress />) : (<Box height={4} />)}

                <Toolbar variant="dense" className="details-top-toolbar">
                    <Box width={20} />

                    <TextField
                        fullWidth
                        label="Function Project Path"
                        disabled={true}
                        InputLabelProps={{ shrink: true }}
                        type="text"
                        value={state.projectPath}
                    />
                    
                    <Box width={20} />
                    <Typography style={{ flex: 1 }} />

                    <Button
                        className="details-refresh-button"
                        variant="outlined"
                        color="default"
                        size="large"
                        disabled={state.inProgress}
                        onClick={() => state.load()}
                    >
                        <RefreshIcon />
                    </Button>

                </Toolbar>
            </AppBar>

            {!!state.diagramSvg && (<>

                <div
                    className="diagram-div"
                    style={CustomTabStyle}
                    dangerouslySetInnerHTML={{ __html: getStyledSvg(state.diagramSvg) }}
                />

                <Toolbar variant="dense">

                    <Button
                        variant="outlined"
                        color="default"
                        disabled={state.inProgress}
                        onClick={() => window.navigator.clipboard.writeText(state.diagramCode)}
                    >
                        <FileCopyIcon />
                        <Box width={10} />
                        <Typography color="inherit">Copy diagram code to Clipboard</Typography>
                    </Button>

                    <Box width={20} />

                    <SaveAsSvgButton
                        svg={getStyledSvg(state.diagramSvg)}
                        fileName="functions.svg"
                        inProgress={state.inProgress}
                        backendClient={state.backendClient}
                    />

                </Toolbar>

            </>)}

            <ErrorMessage state={this.props.state} />
        </>);
    }

    private static backendClient: IBackendClient;

    private static onFunctionNodeClicked(evt: Event): void {

        const el = evt.currentTarget as Element;

        const match = /flowchart-(\w+)-/.exec(el.id);
        if (!!match) {
            FunctionGraph.backendClient.call('GotoFunctionCode', match[1]);
        }
    }

    private mountClickEventToFunctionNodes(nodes: HTMLCollection): void {

        console.log(`Found ${nodes.length} functions`)

        for (var i = 0; i < nodes.length; i++) {
            const node = nodes[i] as Node;

            node.removeEventListener('click', FunctionGraph.onFunctionNodeClicked);
            node.addEventListener('click', FunctionGraph.onFunctionNodeClicked);
        }
    }
}
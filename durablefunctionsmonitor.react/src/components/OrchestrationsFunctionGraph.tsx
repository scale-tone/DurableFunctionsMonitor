import * as React from 'react';
import { observer } from 'mobx-react';

import {
    Box, Button, Checkbox, Chip, FormGroup, FormControlLabel, FormHelperText, Link, Toolbar, Typography
} from '@material-ui/core';

import FileCopyIcon from '@material-ui/icons/FileCopy';

import './OrchestrationsFunctionGraph.css';

import { ResultsFunctionGraphTabState } from '../states/ResultsFunctionGraphTabState';
import { SaveAsSvgButton, getStyledSvg } from './SaveAsSvgButton';
import { IBackendClient } from '../services/IBackendClient';

import { CustomTabStyle, RuntimeStatusToStyle } from '../theme';

// Interactive Function Graph view
@observer
export class OrchestrationsFunctionGraph extends React.Component<{ state: ResultsFunctionGraphTabState, inProgress: boolean, fileName: string, backendClient: IBackendClient }> {

    componentDidMount() {

        window.addEventListener('resize', this.repositionMetricHints);
        this.repositionMetricHints();
    }

    componentWillUnmount() {

        window.removeEventListener('resize', this.repositionMetricHints);
    }

    componentDidUpdate() {

        this.repositionMetricHints();

        const svgElement = document.getElementById('mermaidSvgId');
        if (!!svgElement) {

            this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('function'));
            this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('orchestrator'));
            this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('activity'));
            this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('entity'));
            this.mountClickEventToFunctionNodes(svgElement.getElementsByClassName('proxy'));
        }
    }

    render(): JSX.Element {

        const state = this.props.state;

        return (<>
            
            <FormHelperText className="link-to-az-func-as-a-graph" >
                powered by <Link
                    variant="inherit"
                    href="https://github.com/scale-tone/az-func-as-a-graph"
                >
                    az-func-as-a-graph
                </Link>
            </FormHelperText>

            {!!state.functionsLoaded && (
                <FormGroup row className="settings-group">

                    <FormControlLabel
                        control={<Checkbox
                            color="default"
                            disabled={this.props.inProgress}
                            checked={state.renderFunctions}
                            onChange={(evt) => state.renderFunctions = evt.target.checked}
                        />}
                        label="Show Functions"
                    />

                    <FormControlLabel
                        control={<Checkbox
                            color="default"
                            disabled={this.props.inProgress}
                            checked={state.renderProxies}
                            onChange={(evt) => state.renderProxies = evt.target.checked}
                        />}
                        label="Show Proxies"
                    />

                    {this.renderTotalMetric()}

                </FormGroup>
            )}

            {this.renderMetrics()}

            {!!state.diagramSvg && (<>
                <div
                    className="diagram-div"
                    style={CustomTabStyle}
                    dangerouslySetInnerHTML={{ __html: getStyledSvg(state.diagramSvg) }}
                />

                <Toolbar variant="dense">

                    <Typography style={{ flex: 1 }} />

                    <Button
                        variant="outlined"
                        color="default"
                        disabled={this.props.inProgress}
                        onClick={() => window.navigator.clipboard.writeText(state.diagramCode)}
                    >
                        <FileCopyIcon />
                        <Box width={10} />
                        <Typography color="inherit">Copy diagram code to Clipboard</Typography>
                    </Button>

                    <Box width={20} />

                    <SaveAsSvgButton
                        svg={getStyledSvg(state.diagramSvg)}
                        fileName={this.props.fileName}
                        inProgress={this.props.inProgress}
                        backendClient={this.props.backendClient}
                    />

                    <Box width={20} />
                </Toolbar>
            </>)}
        </>);
    }

    private readonly RunningStyle = RuntimeStatusToStyle("Running");
    private readonly CompletedStyle = RuntimeStatusToStyle("Completed");
    private readonly FailedStyle = RuntimeStatusToStyle("Failed");
    private readonly OtherStyle = RuntimeStatusToStyle("Terminated");

    private renderTotalMetric(): JSX.Element {
        
        const state = this.props.state;
        const totalMetric = state.metrics[state.TotalMetricsName];

        return (!!totalMetric && (!!totalMetric.completed || !!totalMetric.running || !!totalMetric.failed) && (
            <span className="total-metrics-span">

                <Typography variant="body1">Total instances:</Typography>

                <Box width={10}/>
                
                {!!totalMetric.completed && (
                    <Chip className="metrics-chip" style={this.CompletedStyle} variant="outlined" size="small" label={`${totalMetric.completed} completed`} />
                )}
                {!!totalMetric.running && (
                    <Chip className="metrics-chip" style={this.RunningStyle} variant="outlined" size="small" label={`${totalMetric.running} running`} />
                )}
                {!!totalMetric.failed && (
                    <Chip className="metrics-chip" style={this.FailedStyle} variant="outlined" size="small" label={`${totalMetric.failed} failed`} />
                )}
                {!!totalMetric.other && (
                    <Chip className="metrics-chip" style={this.OtherStyle} variant="outlined" size="small" label={`${totalMetric.other} other`} />
                )}
                
            </span>)
        );
    }
    
    private renderMetrics(): JSX.Element[] {
        
        const state = this.props.state;

        return Object.keys(state.metrics).map(name => {

            const metric = state.metrics[name];

            return (<span id={`metrics-hint-${name}`} key={`metrics-hint-${name}`} className="metrics-span">

                {!!metric.completed && (
                    <Chip className="metrics-chip" style={this.CompletedStyle} variant="outlined" size="small" label={`${metric.completed}`} />
                )}
                {!!metric.running && (
                    <Chip className="metrics-chip" style={this.RunningStyle} variant="outlined" size="small" label={`${metric.running}`} />
                )}
                {!!metric.failed && (
                    <Chip className="metrics-chip" style={this.FailedStyle} variant="outlined" size="small" label={`${metric.failed}`} />
                )}
                {!!metric.other && (
                    <Chip className="metrics-chip" style={this.OtherStyle} variant="outlined" size="small" label={`${metric.other}`} />
                )}
                
            </span>);
        });
    }

    private repositionMetricHints() {

        const allMetricsHintNodes = document.getElementsByClassName('metrics-span');
        for (var i = 0; i < allMetricsHintNodes.length; i++) {
            const metricsHintNode = allMetricsHintNodes[i] as HTMLElement;
            metricsHintNode.style.visibility = 'hidden';
        }
        
        const svgElement = document.getElementById('mermaidSvgId');
        if (!svgElement) {
            return;
        }

        svgElement.onresize = () => {
            this.repositionMetricHints();
        };

        const instanceNodes = Array.from(svgElement.getElementsByClassName('entity'))
            .concat(Array.from(svgElement.getElementsByClassName('orchestrator')));
        
        for (var instanceNode of instanceNodes) {

            const match = /flowchart-(.+)-/.exec(instanceNode.id);
            if (!!match) {

                const functionName = match[1];
                const metricsHintNode = document.getElementById(`metrics-hint-${functionName}`);
                if (!!metricsHintNode) {

                    const instanceNodeRect = instanceNode.getBoundingClientRect();
                    
                    metricsHintNode.style.visibility = 'visible';
                    metricsHintNode.style.left = `${instanceNodeRect.left}px`;
                    metricsHintNode.style.top = `${instanceNodeRect.top - 30}px`;
                }
            }
        }
    }

    private mountClickEventToFunctionNodes(nodes: HTMLCollection): void {

        const state = this.props.state;

        for (var i = 0; i < nodes.length; i++) {
            const el = nodes[i] as HTMLElement;

            const match = /flowchart-(.+)-/.exec(el.id);
            if (!!match) {

                const closuredFunctionName = match[1];
                el.onclick = () => state.gotoFunctionCode(closuredFunctionName);
                el.style.cursor = 'pointer';
            }
        }
    }
}
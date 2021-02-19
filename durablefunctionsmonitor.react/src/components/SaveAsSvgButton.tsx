import * as React from 'react';

import { Button, Typography } from '@material-ui/core';

import SaveIcon from '@material-ui/icons/Save';

import './SaveAsSvgButton.css';

import { IBackendClient } from '../services/IBackendClient';

// A button to save something as an .SVG file
export class SaveAsSvgButton extends React.Component<{ svg: string, orchestrationId: string, inProgress: boolean, backendClient: IBackendClient }> {

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

// Appends some styling to SVG code, so it can also be saved as file
export function getStyledSvg(svg: string): string {

    return svg.replace('</style>',
        '.note { stroke: none !important; fill: none !important; } ' +
        '.noteText { font-size: 9px !important; } ' +
        '</style>'
    );
}

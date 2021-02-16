import { createMuiTheme } from "@material-ui/core";

import { RuntimeStatus } from './states/DurableOrchestrationStatus';

// Config object passed as a global variable
declare const DfmClientConfig: { theme: string };

const colorTheme = !process.env.REACT_APP_COLOR_THEME ? DfmClientConfig.theme : process.env.REACT_APP_COLOR_THEME;

export const Theme = createMuiTheme({
    palette: { type: colorTheme === 'dark' ? 'dark': 'light' }
});

export function RuntimeStatusToStyle(status: RuntimeStatus): {} {

    var backgroundColor: string = null;

    switch (status) {
        case "Failed":
            backgroundColor = hexToRGBA(Theme.palette.error.light, 0.2);
            break;
        case "Completed":
            backgroundColor = hexToRGBA(Theme.palette.success.light, 0.2);
            break;
        case "Running":
            backgroundColor = hexToRGBA(Theme.palette.warning.light, 0.2);
            break;
        case "Terminated":
            backgroundColor = hexToRGBA(Theme.palette.background.paper, 0.1);
            break;
    }

    return !!backgroundColor ? { backgroundColor } : {};
}

export function hexToRGBA(hex: string, alpha: number): string {

    if (hex.length > 4) {
        return `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${alpha.toFixed(1)})`;
    } else {
        return `rgba(${parseInt(hex.slice(1, 2), 16)}, ${parseInt(hex.slice(2, 3), 16)}, ${parseInt(hex.slice(3, 4), 16)}, ${alpha.toFixed(1)})`;
    }
}

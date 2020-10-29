import * as React from 'react';
import * as ReactDOM from 'react-dom';

import registerServiceWorker from './registerServiceWorker';

import './index.css';

import { Main } from './components/Main';
import { MainState } from './states/MainState';

// This is the app's global state. It consists of multiple parts, consumed by multiple nested components
const appState = new MainState();

ReactDOM.render(
    <Main state={appState}/>,
    document.getElementById('root') as HTMLElement
);

registerServiceWorker();

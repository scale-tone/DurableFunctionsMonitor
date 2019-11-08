const ncp = require('ncp').ncp;
const rimraf = require("rimraf");

const buildFolder = './build';
const outputFolder = '../durablefunctionsmonitor.dotnetbackend/wwwroot';

rimraf.sync(`${outputFolder}/static/`);
ncp(`${buildFolder}/static/`, `${outputFolder}/static/`);
ncp(`${buildFolder}/manifest.json`, `${outputFolder}/manifest.json`);
ncp(`${buildFolder}/service-worker.js`, `${outputFolder}/service-worker.js`);
ncp(`${buildFolder}/favicon.png`, `${outputFolder}/favicon.png`);
ncp(`${buildFolder}/index.html`, `${outputFolder}/index.html`);
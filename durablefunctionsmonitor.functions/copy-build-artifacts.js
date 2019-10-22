const fs = require('fs');
const ncp = require('ncp').ncp;
const rimraf = require("rimraf");

const outputFolder = '../durablefunctionsmonitor-vscodeext/backend';

if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder);
}

rimraf.sync(`${outputFolder}/bin/`);
rimraf.sync(`${outputFolder}/dist/`);
rimraf.sync(`${outputFolder}/node_modules/`);
rimraf.sync(`${outputFolder}/wwwroot/`);

ncp(`./node_modules/`, `${outputFolder}/node_modules/`);
ncp(`./bin/`, `${outputFolder}/bin/`);
ncp(`./dist/`, `${outputFolder}/dist/`);

ncp(`./easyauth-config/`, `${outputFolder}/easyauth-config/`);
ncp(`./manage-connection/`, `${outputFolder}/manage-connection/`);
ncp(`./monitor/`, `${outputFolder}/monitor/`);
ncp(`./orchestration/`, `${outputFolder}/orchestration/`);
ncp(`./orchestrations/`, `${outputFolder}/orchestrations/`);
ncp(`./wwwroot/`, `${outputFolder}/wwwroot/`);

ncp(`./host.json`, `${outputFolder}/host.json`);
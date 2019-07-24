import { AzureFunction, Context } from '@azure/functions'

const fs = require('fs');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);

// A simple statics hosting solution
const httpTrigger: AzureFunction = async function (context: Context): Promise<void> {

    const path1 = context.bindingData.path1;
    const path2 = context.bindingData.path2;
    const path3 = context.bindingData.path3;

    if (path1 === 'static') {
        context.res = await serveStatic(path1, path2, path3);
        return;
    }

    if (path1 === 'manifest.json') {
        context.res = await serveManifestJson();
        return;
    }

    if (path1 === 'favicon.png') {
        context.res = await serveFavicon();
        return;
    }

    // serving index.html for the rest, to make React Routing work
    context.res = await serveIndexHtml();
};

async function serveStatic(path1: string, path2: string, path3: string) {
    
    const body = await readFileAsync(`./wwwroot/${path1}/${path2}/${path3}`);
    
    var contentType = null;
    switch (path2) {
        case 'css':
            contentType = 'text/css; charset=utf-8';
            break;
        case 'js':
            contentType = 'application/javascript; charset=UTF-8';
            break;
        case 'media':
            contentType = 'image/svg+xml; charset=UTF-8';
            break;
    }

    return {
        body: body,
        headers: { 'Content-Type': contentType }
    };
}

async function serveManifestJson() {
    return {
        body: await readFileAsync('./wwwroot/manifest.json'),
        headers: {
            'Content-Type': 'application/json; charset=UTF-8'
        }
    };
}

async function serveFavicon() {
    return {
        body: await readFileAsync('./wwwroot/favicon.png'),
        headers: {
            'Content-Type': 'image/png'
        }
    };
}

async function serveIndexHtml() {
    return {
        body: await readFileAsync('./wwwroot/index.html'),
        headers: {
            'Content-Type': 'text/html; charset=UTF-8'
        }
    };
}

export default httpTrigger;

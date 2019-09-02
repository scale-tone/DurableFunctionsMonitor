import { AzureFunction, Context } from '@azure/functions'

const fs = require('fs');
const util = require('util');
const readFileAsync = util.promisify(fs.readFile);
const fileExistsAsync = util.promisify(fs.exists);

// Root folder where all the statics are copied to
const wwwroot = './wwwroot';

// A simple statics hosting solution
const httpTrigger: AzureFunction = async function (context: Context): Promise<void> {

    const path1 = context.bindingData.path1;
    const path2 = context.bindingData.path2;
    const path3 = context.bindingData.path3;

    const fileMap = {
        'static/css': {
            fileName: `${wwwroot}/static/css/${path3}`,
            contentType: 'text/css; charset=utf-8'
        },
        'static/js': {
            fileName: `${wwwroot}/static/js/${path3}`,
            contentType: 'application/javascript; charset=UTF-8'
        },
        'static/media': {
            fileName: `${wwwroot}/static/media/${path3}`,
            contentType: 'image/svg+xml; charset=UTF-8'
        },
        'manifest.json/undefined': {
            fileName: `${wwwroot}/manifest.json`,
            contentType: 'application/json; charset=UTF-8'
        },
        'service-worker.js/undefined': {
            fileName: `${wwwroot}/service-worker.js`,
            contentType: 'application/javascript; charset=UTF-8'
        },
        'favicon.png/undefined': {
            fileName: `${wwwroot}/favicon.png`,
            contentType: 'image/png'
        }
    };

    const mapEntry = fileMap[`${path1}/${path2}`];

    if (!!mapEntry) {

        if (await fileExistsAsync(mapEntry.fileName)) {

            context.res = {
                body: await readFileAsync(mapEntry.fileName),
                headers: { 'Content-Type': mapEntry.contentType }
            };

        } else {

            context.res = { status: 404 };
        }

    } else {

        // Returning index.html by default, to support client routing
        context.res = {
            body: await readFileAsync(`${wwwroot}/index.html`),
            headers: { 'Content-Type': 'text/html; charset=UTF-8' }
        };
    }
};

export default httpTrigger;

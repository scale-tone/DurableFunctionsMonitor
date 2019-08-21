![logo](https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/main-page.png) 
# Durable Functions Monitor

A monitoring/debugging UI tool for Azure Durable Functions

[Azure Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) provide an easy and elegant way of building cloud-native Reliable Stateful Services in the Serverless world. The only thing that's missing so far is a UI for monitoring, managing and debugging your orchestration instances. This project tries to bridge the gap.



## Prerequisites
To run this on your devbox you need to have [Azure Functions Core Tools](https://www.npmjs.com/package/azure-functions-core-tools) globally installed (which is normally already the case, if you're working with Azure Functions - just ensure that you have the latest version of it).

**OR**

[Docker Desktop](https://www.docker.com/products/docker-desktop).

## How to run
* Get the sources (either via **git clone** or by just downloading the ZIP-file) from this repo.
* Open command line in **durablefunctionsmonitor.functions** folder.
* Type **npm run setup-and-run**. This will install all needed dependencies and compile the Functions project. At first run the setup script will also ask you to provide the Connection String to your Azure Storage, that your existing Durable Functions are using. Then it will create a local.settings.json file and put that Connection String into it. 
* Finally the setup script will open the UI page (http://localhost:7072/api/monitor) in your favourite browser. If not, then just navigate to that URL yourself (on a Mac it is reported to be more preferrable to open http://127.0.0.1:7072/api/monitor instead).

Executing **npm run setup-and-run** is only needed at first run. Next time you can just type **func start** and open the UI page in your browser.

**OR**

Just run [this Docker container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) locally:
* **docker pull scaletone/durablefunctionsmonitor:1.0**
* **docker run -p 7072:80 -e AzureWebJobsStorage="your-azure-storage-connection-string" scaletone/durablefunctionsmonitor:1.0**
* Navigate to http://localhost:7072/api/monitor

## Features
* View the list of your orchestration instances, with sorting, infinite scrolling and auto-refresh:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations.png" width="1076">

* Filter by time range and column values:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations-filtered.png" width="756">

* Monitor the status of a certain orchestration instance:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-details.png" width="756">

* Rewind, Terminate, Raise Events:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-raise-event.png" width="440">

* Connect to different Durable Function Hubs and Azure Storage Accounts:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/manage-connection.png" width="609">

## Details

This tool is itself a set of Azure Functions (written in TypeScript), but is intended to run locally on your devbox. 
The [UI part](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.react) is written with React+MobX+TypeScript+Material UI. It's compiled statics are being served by a [separate Function](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.functions/monitor). [The rest of Functions](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.functions) is just a thin wrapper layer around [Durable Functions management interface](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-instance-management). 

By installing this tool you effectively get all the sources, so you're free to customize and improve it according to your needs.

UI's pre-built static artifacts are intentionally committed into [this wwwroot folder](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.functions/wwwroot), as building them upon first run takes forever. You can always rebuild them with **npm run build**. 

NOTE: technically, nothing prevents you from deploying and hosting this management tool in Azure under your own Azure Function instance. Except that **so far there is no any authentication layer implemented**. So it would be entirely your responsibility to protect that Azure Function instance somehow, e.g. by configuring [Easy Auth with AAD](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization), while ensuring that only the authorized people get access.

Enjoy and please report any bugs.

## Known Issues

* Beware of [this Docker Desktop trouble](https://forums.docker.com/t/docker-for-windows-10-time-out-of-sync/21506). Whenever your laptop goes to sleep, time might freeze inside your containers. Which forces all outgoing HTTPS connections to fail due to a big time lag, so everything just breaks. If after starting the container you only see "function host is not running" error in your browser, then try to restart your Docker Desktop.

![logo](https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/main-page.png) 
# Durable Functions Monitor

A monitoring/debugging UI tool for Azure Durable Functions

[Azure Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) provide an easy and elegant way of building cloud-native Reliable Stateful Services in the Serverless world. The only thing that's missing so far is a UI for monitoring, managing and debugging your orchestration instances. This project tries to bridge the gap.

<img src="https://dev.azure.com/kolepes/DurableFunctionsMonitor/_apis/build/status/DurableFunctionsMonitor-Azure%20Functions%20for%20Node.js-CI"/>

## Prerequisites
To run this on your devbox you need to have [Azure Functions Core Tools](https://www.npmjs.com/package/azure-functions-core-tools) globally installed (which is normally already the case, if you're working with Azure Functions - just ensure that you have the latest version of it).

**OR**

[Docker Desktop](https://www.docker.com/products/docker-desktop).

## How to run

As a VsCode Extension.
* Install it [from the Marketplace](https://marketplace.visualstudio.com/items?itemName=DurableFunctionsMonitor.durablefunctionsmonitor) or from [this VSIX-file](https://github.com/scale-tone/DurableFunctionsMonitor/releases/download/v1.2/durablefunctionsmonitor-1.2.0.vsix).
* Command Palette->Durable Functions Monitor.
* Confirm or provide Storage Connection String and Hub Name.

**OR**

[As a standalone service](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/README.md#durablefunctionsmonitordotnetbackend), either running locally on your devbox or deployed into Azure.

## Features
* View the list of your orchestration instances, with sorting, infinite scrolling and auto-refresh:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations.png" width="1076">

* Filter by time range and column values:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations-filtered.png" width="756">

* Monitor the status of a certain orchestration instance:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-details.png" width="756">

* Rewind, Terminate, Raise Events:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-raise-event.png" width="440">

* Purge orchestration instances history:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-menu.png" width="390">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-dialog.png" width="683">

* Connect to different Durable Function Hubs and Azure Storage Accounts:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/manage-connection.png" width="609">

## Known Issues

* Beware of [this Docker Desktop trouble](https://forums.docker.com/t/docker-for-windows-10-time-out-of-sync/21506). Whenever your laptop goes to sleep, time might freeze inside your containers. Which forces all outgoing HTTPS connections to fail due to a big time lag, so everything just breaks. If after starting the container you only see "function host is not running" error in your browser, then try to restart your Docker Desktop.

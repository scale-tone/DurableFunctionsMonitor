# Durable Functions Monitor as a VsCode Extension

List/monitor/debug your Azure Durable Functions inside VsCode.
**Command Palette -> Durable Functions Monitor** or right-click on your **host.json** file and use the context menu.

## Features

* List your Orchestrations and/or Durable Entities, with sorting, infinite scrolling and auto-refresh.
* Monitor the status of a certain Orchestration/Durable Entity. Purge, Rewind, Terminate, Raise Events.
* Purge Orchestrations/Durable Entities history - **Command Palette -> Purge Durable Functions History**
* Connect to different Task Hubs.

## Pictures

<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-command-palette.png" width="624">

<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-orchestrations.png" width="768">

<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-orchestration.png" width="843">

<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vsext-context-menu.png" width="300">

## Prerequisites

Make sure you have the latest [Azure Functions Core Tools](https://www.npmjs.com/package/azure-functions-core-tools) globally installed on your devbox.

More info and sources on [the github repo](https://github.com/scale-tone/DurableFunctionsMonitor#features).

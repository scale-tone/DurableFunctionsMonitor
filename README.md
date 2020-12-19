![logo](https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/main-page.png) 
# Durable Functions Monitor

A monitoring/debugging UI tool for Azure Durable Functions

[Azure Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) provide an easy and elegant way of building cloud-native Reliable Stateful Services in the Serverless world. The only thing that's missing so far is a UI for monitoring, managing and debugging your orchestration instances. This project tries to bridge the gap.

<img src="https://dev.azure.com/kolepes/DurableFunctionsMonitor/_apis/build/status/DurableFunctionsMonitor-CI-from-yml?branchName=master"/> [<img alt="Visual Studio Marketplace Installs" src="https://img.shields.io/visual-studio-marketplace/i/DurableFunctionsMonitor.DurableFunctionsMonitor?label=VsCode%20Extension%20Installs">](https://marketplace.visualstudio.com/items?itemName=DurableFunctionsMonitor.durablefunctionsmonitor) [<img src="https://img.shields.io/docker/pulls/scaletone/durablefunctionsmonitor"/>](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) [<img alt="Nuget" src="https://img.shields.io/nuget/v/DurableFunctionsMonitor.DotNetBackend?label=current%20version">](https://www.nuget.org/profiles/durablefunctionsmonitor) [<img alt="Nuget" src="https://img.shields.io/nuget/dt/DurableFunctionsMonitor.DotNetBackend?label=nuget%20downloads">](https://www.nuget.org/profiles/durablefunctionsmonitor)

# Prerequisites
To run this on your devbox you need to have [Azure Functions Core Tools](https://www.npmjs.com/package/azure-functions-core-tools) **globally** installed (which is normally already the case, if you're working with Azure Functions - just ensure that you have the latest version of it).

**OR**

[Docker Desktop](https://www.docker.com/products/docker-desktop), if you prefer to run it locally [as a container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor).

# How to run

As a [VsCode Extension](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor-vscodeext/README.md#durable-functions-monitor-as-a-vscode-extension).
* Install it [from the Marketplace](https://marketplace.visualstudio.com/items?itemName=DurableFunctionsMonitor.durablefunctionsmonitor) or from [a VSIX-file](https://github.com/scale-tone/DurableFunctionsMonitor/releases).
* (if you have [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) extension also installed) Goto **Azure Functions** <img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-functions-view-container-icon.png" width="32"> View Container, observe all your TaskHubs under **DURABLE FUNCTIONS** tab and click on them to connect.
* (if not) Type `Durable Functions Monitor` in your Command Palette and then confirm or provide Storage Connection String and Hub Name.

**OR**

[As a standalone service](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/README.md#durablefunctionsmonitordotnetbackend), either running locally on your devbox or deployed into Azure.

# Features
## 1. View the list of your Orchestrations and/or Durable Entities, with sorting, infinite scrolling and auto-refresh:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations.png" width="882">

## 2. Filter by time range and column values:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations-filtered.png" width="882">

## 3. Monitor the status of a certain instance:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-details.png" width="882">

## 4. Quickly navigate to a certain instance by its ID:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/goto-instance.png" width="882">

## 4. Observe Sequence Diagrams and Gantt Charts for orchestrations:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-orchestration-diagram.png" width="400">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/gantt-chart.png" width="650">

## 5. Restart, Purge, Rewind, Terminate, Raise Events, Set Custom Status:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-raise-event.png" width="440">

## 6. Purge Orchestration/Entity instances history:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-menu.png" width="390">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-dialog.png" width="683">

## 7. Clean deleted Durable Entities:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/clean-entity-storage-menu.png" width="390">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/clean-entity-storage-dialog.png" width="580">

## 8. Create custom Orchestration/Entity status tabs with [Liquid Templates](https://shopify.github.io/liquid/):
  1. Create a [Liquid](https://shopify.github.io/liquid/) template file and name it like `[My Custom Tab Name].[orchestration-or-entity-name].liquid` or just `[My Custom Tab Name].liquid` (this one will be applied to any kind of entity).
  2. In the same Storage Account (the account where your Durable Functions run in) create a Blob container called `durable-functions-monitor`.
  3. Put your template file into a `tab-templates` virtual folder in that container (the full path should look like `/durable-functions-monitor/tab-templates/[My Custom Tab Name].[orchestration-or-entity-name].liquid`).
  4. Restart Durable Functions Monitor.
  5. Observe the newly appeared `My Custom Tab Name` tab on the Orchestration/Entity Details page:
  
  <img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/custom-liquid-tab.png" width="390">
  
   Sample Liquid Template:
   ```
    <h2>These people were invited:</h2>
    <ul>
    {% for participant in Input.Participants %}
      <li><h3>{{participant}}<h3></li>
    {% endfor %}
    </ul>  
   ```
  
   You can have multiple templates for each Orchestration/Entity type, and also multiple 'common' (applied to any Orchestration/Entity) templates.
   Here is [one more sample template](https://gist.github.com/scale-tone/13956ec804a70f5f66200c6ec97db673).
   
   NOTE1: [this .Net object](https://docs.microsoft.com/en-us/dotnet/api/microsoft.azure.webjobs.extensions.durabletask.durableorchestrationstatus?view=azure-dotnet) is passed to your templates as a parameter. Mind the property names and their casing.
   
   NOTE2: code inside your templates is still subject to these [Content Security Policies](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.react/public/index.html#L8), so no external scripts, sorry.

## 9. Connect to different Durable Function Hubs and Azure Storage Accounts:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/manage-connection.png" width="609">

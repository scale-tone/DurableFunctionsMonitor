![logo](https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/main-page.png) 
# Durable Functions Monitor

A monitoring/debugging UI tool for Azure Durable Functions

[Azure Durable Functions](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview) provide an easy and elegant way of building cloud-native Reliable Stateful Services in the Serverless world. The only thing that's missing so far is a UI for monitoring, managing and debugging your orchestration instances. This project tries to bridge the gap.

[<img alt="Nuget" src="https://img.shields.io/nuget/v/DurableFunctionsMonitor.DotNetBackend?label=current%20version">](https://www.nuget.org/profiles/durablefunctionsmonitor)  <img src="https://dev.azure.com/kolepes/DurableFunctionsMonitor/_apis/build/status/DurableFunctionsMonitor-CI-from-yml?branchName=master"/> <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/scale-tone/DurableFunctionsMonitor?style=flat">

[<img alt="Visual Studio Marketplace Installs" src="https://img.shields.io/visual-studio-marketplace/i/DurableFunctionsMonitor.DurableFunctionsMonitor?label=VsCode%20Extension%20Installs">](https://marketplace.visualstudio.com/items?itemName=DurableFunctionsMonitor.durablefunctionsmonitor) [<img src="https://img.shields.io/docker/pulls/scaletone/durablefunctionsmonitor"/>](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) [<img alt="Nuget" src="https://img.shields.io/nuget/dt/DurableFunctionsMonitor.DotNetBackend?label=nuget%20downloads">](https://www.nuget.org/profiles/durablefunctionsmonitor)

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

[As a standalone service](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/README.md#durablefunctionsmonitordotnetbackend), either running locally on your devbox or deployed into Azure: [![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fscale-tone%2FDurableFunctionsMonitor%2Fmaster%2Fdurablefunctionsmonitor.dotnetbackend%2Farm-template.json) 

**OR**

[Install it as a NuGet package](https://www.nuget.org/packages/DurableFunctionsMonitor.DotNetBackend) into your own Functions project (.Net Core only).

# Features
## 1. View the list of your Orchestrations and/or Durable Entities, with sorting, infinite scrolling and auto-refresh:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations.png" width="882">

## 2. Filter by time range and column values:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestrations-filtered.png" width="882">

## 3. Visualize the filtered list of instances as a Time Histogram or as a Gantt chart:
<img src="https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/readme/screenshots/time-histogram.png" width="700">

## 4. Monitor the status of a certain instance:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-details.png" width="882">

## 5. Quickly navigate to a certain instance by its ID:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/goto-instance.png" width="400">

## 6. Observe Sequence Diagrams and Gantt Charts for orchestrations:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-orchestration-diagram.png" width="400">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/gantt-chart.png" width="650">

## 7. Restart, Purge, Rewind, Terminate, Raise Events, Set Custom Status:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/orchestration-raise-event.png" width="440">

## 8. Purge Orchestration/Entity instances history:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-menu.png" width="390">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/purge-history-dialog.png" width="683">

## 9. Clean deleted Durable Entities:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/clean-entity-storage-menu.png" width="390">
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/clean-entity-storage-dialog.png" width="580">

## 10. Create custom Orchestration/Entity status tabs with [Liquid Templates](https://shopify.github.io/liquid/):
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
   Here is [a couple](https://gist.github.com/scale-tone/13956ec804a70f5f66200c6ec97db673) [of more](https://github.com/scale-tone/repka-durable-func/blob/master/Repka%20Status.the-saga-of-repka.liquid) sample templates.
   
   NOTE1: [this .Net object](https://docs.microsoft.com/en-us/dotnet/api/microsoft.azure.webjobs.extensions.durabletask.durableorchestrationstatus?view=azure-dotnet) is passed to your templates as a parameter. Mind the property names and their casing.
   
   NOTE2: code inside your templates is still subject to these [Content Security Policies](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.react/public/index.html#L8), so no external scripts, sorry.

## 11. Connect to different Durable Function Hubs and Azure Storage Accounts:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/manage-connection.png" width="609">

## 12. Monitor non-default Storage Providers (Netherite, Microsoft SQL, etc.):
  
  For that you can use Durable Functions Monitor in 'injected' mode, aka added as a [NuGet package](https://www.nuget.org/profiles/durablefunctionsmonitor) to *your* project.
  
  1. Create a .Net Core Function App project, that is [configured to use an alternative Storage Provider](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-storage-providers#azure-storage) and make sure it compiles and starts.
  2. Add [DurableFunctionsMonitor.DotNetBackend](https://www.nuget.org/profiles/durablefunctionsmonitor) package to it:
   ```
    dotnet add package DurableFunctionsMonitor.DotNetBackend
   ```
  
  4. Add mandatory initialization code, that needs to run at your Function's startup:
   ```
[assembly: WebJobsStartup(typeof(StartupNs.Startup))]
namespace StartupNs 
{
     public class Startup : IWebJobsStartup
     {
        public void Configure(IWebJobsBuilder builder)
        {
           DfmEndpoint.Setup();
        }
     }
}
   ```
  
   Find more details on programmatic configuration options in the [package readme](https://www.nuget.org/packages/DurableFunctionsMonitor.DotNetBackend/).
    
  6. Run the project:
   ```
    func start
   ```
    
  8. Navigate to `http://localhost:7071/api`. 
    You can customize the endpoint address as needed, as described [here](https://www.nuget.org/packages/DurableFunctionsMonitor.DotNetBackend/).

## 13. Visualize your Azure Function projects in form of an interactive graph: 
  
  This functionality is powered by [az-func-as-a-graph](https://github.com/scale-tone/az-func-as-a-graph/blob/main/README.md) tool, but now it is also fully integrated into Durable Functions Monitor:
  ![image](https://user-images.githubusercontent.com/5447190/127571400-f83c7f96-55bc-4714-8323-04d26f3be74f.png)

When you run Durable Functions Monitor as [VsCode Extension](https://marketplace.visualstudio.com/items?itemName=DurableFunctionsMonitor.durablefunctionsmonitor), the **Functions Graph** tab should appear automatically, once you have the relevant Functions project opened.

When running in standalone/injected mode you'll need to generate and upload an intermediate Functions Map JSON file. 
1. Generate it with [az-func-as-a-graph CLI](https://github.com/scale-tone/az-func-as-a-graph/blob/main/README.md#how-to-run-as-part-of-azure-devops-build-pipeline). Specify `dfm-func-map.<my-task-hub-name>.json` (will be applied to that particular Task Hub only) or just `dfm-func-map.json` (will be applied to all Task Hubs) as the output name.
2. Upload this generated JSON file to `function-maps` virtual folder inside `durable-functions-monitor` BLOB container in the underlying Storage Account (the full path should look like `/durable-functions-monitor/function-maps/dfm-func-map.<my-task-hub-name>.json`).
3. Restart Durable Functions Monitor.
4. Observe the newly appeared `Functions Graph` tab.

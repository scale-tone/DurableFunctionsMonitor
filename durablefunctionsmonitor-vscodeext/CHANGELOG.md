# Change Log

## Version 3.5

- Now the **Orchestration Details** page features a nice [mermaid](https://www.npmjs.com/package/mermaid)-based sequence diagram:
<img src="https://raw.githubusercontent.com/scale-tone/DurableFunctionsMonitor/master/readme/screenshots/vscodeext-orchestration-diagram-small.png">
- Also it's now possible to navigate to suborchestrations from the history list on the **Orchestration Details** page.

## Version 3.4

- Now integrated with [Azure Account](https://marketplace.visualstudio.com/items?itemName=ms-vscode.azure-account) extension, so once logged in to Azure, you can now see and connect to all your TaskHubs. It is also still possible to connect with connection strings, as before. NOTE1: only filtered Azure Subscriptions are shown, so make sure your filter is set correctly with [Azure: Select Subscriptions](https://docs.microsoft.com/en-us/azure/governance/policy/how-to/extension-for-vscode#select-subscriptions) command. NOTE2: many things can go wrong when fetching the list of TaskHubs, so to investigate those problems you can [enable logging](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor-vscodeext/CHANGELOG.md#version-21) and then check the 'Durable Functions Monitor' output channel.

## Version 3.3

- customStatus value of your orchestration instances can now be changed with 'Set Custom Status' button.
- Minor bugfixes.

## Version 3.2

- You can now delete unused Task Hubs with 'Delete Task Hub...' context menu item.
- Better (non-native) DateTime pickers.

## Version 3.1

- Minor security improvements.
- List of existing Task Hubs is now loaded from your Storage Account and shown to you, when connecting to a Task Hub.

## Version 3.0

- A 'DURABLE FUNCTIONS' TreeView added to Azure Functions View Container. It displays all currently attached Task Hubs, allows to connect to multiple Task Hubs and switch between them. You need to have [Azure Functions](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-azurefunctions) extension installed to see it (which is typically the case if you work with Azure Functions in VSCode).

## Version 2.2

- Bulk purge for Durable Entities as well.
- Prettified JSON on instance details page.

## Version 2.1

- Instances list sort order is now persisted as well.
- Whenever backend initialization fails, its error message is now being shown immediately (instead of a generic 'timeout' message as before).
- A complete backend output can now be logged into a file for debugging purposes. Open the **settings.json** file in extension's folder and set the **logging** setting to **true**. That will produce a **backend/backend-37072.log** file with full console output from func.exe.

## Version 2.0

- More native support for Durable Entities.
- Backend migrated to Microsoft.Azure.WebJobs.Extensions.DurableTask 2.0.0. Please, ensure you have the latest Azure Functions Core Tools installed globally, otherwise the backend might fail to start.
- Now displaying connection info (storage account name/hub name) in the tab title.

## Version 1.3

- Implemented purging orchestration instance history. Type 'Purge Durable Functions History...' in your Command Palette.
- Added a context menu over a **host.json** file.
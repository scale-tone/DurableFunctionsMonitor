# Change Log

## Version 2.0

- More native support for Durable Entities.
- Backend migrated to Microsoft.Azure.WebJobs.Extensions.DurableTask 2.0.0. Please, ensure you have the latest Azure Functions Core Tools installed globally, otherwise the backend might fail to start.
- Now displaying connection info (storage account name/hub name) in the tab title.

## Version 1.3

- Implemented purging orchestration instance history. Type 'Purge Durable Functions History...' in your Command Palette.
- Added a context menu over a **host.json** file.
# Change Log

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
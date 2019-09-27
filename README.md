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
* Get the sources (either via **git clone** or by just downloading the ZIP-file) from this repo.
* Open command line in **durablefunctionsmonitor.functions** folder.
* Type **npm run setup-and-run**. This will install all needed dependencies and compile the Functions project. At first run the setup script will also ask you to provide the Connection String to your Azure Storage, that your existing Durable Functions are using. Then it will create a local.settings.json file and put that Connection String into it. 
* Finally the setup script will open the UI page (http://localhost:7072/api/monitor) in your favourite browser. If not, then just navigate to that URL yourself (on a Mac it is reported to be more preferrable to open http://127.0.0.1:7072/api/monitor instead).

Executing **npm run setup-and-run** is only needed at first run. Next time you can just type **func start** and open the UI page in your browser.

**OR**

Run [this Docker container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) locally:
* **docker pull scaletone/durablefunctionsmonitor:1.0**
* **docker run -p 7072:80 -e AzureWebJobsStorage="your-azure-storage-connection-string" scaletone/durablefunctionsmonitor:1.0**
* Navigate to http://localhost:7072/api/monitor

**OR**

Deploy to your own Azure Function instance (separate from where your Durable Functions are running) and **protect** it with [Easy Auth and AAD](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization) (NOTE: AAD login support and token validation added starting from **v.1.1.0**).

* Create a new AAD app (*Azure Portal->Azure Active Directory->App Registrations*).
* On *Authentication* tab add a *Redirect URI* (should be like 'https://your-function-app.azurewebsites.net/api/monitor') and enable *ID tokens* **and** *Access tokens*.
* Create a new Function App instance with JavaScript stack and setup *Easy Auth* with *AAD in Advanced Mode* for it. Specify your AAD app's Client ID and 'https://login.microsoftonline.com/your-tenant-id/v2.0' as *Issuer Url*. Also set *Action to take when request is not authenticated* to *Allow anonymous requests (no action)* (since statics are hosted by the same endpoint, they should be accessible without authentication).
* Set **AzureWebJobsStorage** configuration setting to the correct Azure Storage instance (the one that's being used by your Durable Functions).
* Open **durablefunctionsmonitor.functions** folder with Visual Studio Code and deploy it to your Function App instance.
* **IMPORTANT:** so far **any** user of your tenant can login to your freshly deployed Durable Functions Monitor. To restrict the list of allowed users you have two options:

    For your AAD app set *User Assignment Required* to *Yes* and explicitly add whitelisted users/groups via *Users and groups* tab. WARNING: this option might lead to your users faced with *Administrator's Consent Required* error page, when they try to login (in which case you'll need to provide that Administrator's Consent...).
    
    **OR**
    
    Add **DFM_ALLOWED_USER_NAMES** configuration setting with a comma-separated list of emails. The backend then [will only allow users from this list to call itself](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.functions/ValidateIdentity.ts#L30).
* Navigate to https://your-function-app.azurewebsites.net/api/monitor and ensure you can login (and unwelcomed ones cannot).

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

Technically, nothing prevents you from deploying and hosting this management tool in Azure under your own Azure Function instance, but in that case it **must** be secured with [Easy Auth](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization). Support for AAD login was added to **v.1.1.0** (client side [signs the user in and obtains an access token](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.react/src/states/LoginState.ts), backend [validates the token and the user](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.functions/ValidateIdentity.ts)), but it needs to be configured properly, as described above.

Enjoy and please report any bugs.

## Known Issues

* Beware of [this Docker Desktop trouble](https://forums.docker.com/t/docker-for-windows-10-time-out-of-sync/21506). Whenever your laptop goes to sleep, time might freeze inside your containers. Which forces all outgoing HTTPS connections to fail due to a big time lag, so everything just breaks. If after starting the container you only see "function host is not running" error in your browser, then try to restart your Docker Desktop.

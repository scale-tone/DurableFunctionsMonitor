# DurableFunctionsMonitor.DotNetBackend

Backend for DurableFunctionsMonitor, reimplemented in C#. Also serves the UI statics (at root URL: http://localhost:7072).

Use this project as a standalone service, either run it locally or deploy to Azure (and **protect** with AAD).

## Prerequisites
To run this on your devbox you need to have [Azure Functions Core Tools](https://www.npmjs.com/package/azure-functions-core-tools) globally installed (which is normally already the case, if you're working with Azure Functions - just ensure that you have the latest version of it).

**OR**

[Docker Desktop](https://www.docker.com/products/docker-desktop), if you prefer to run it locally [as a container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor).

## How to run

[![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fscale-tone%2FDurableFunctionsMonitor%2Fmaster%2Fdurablefunctionsmonitor.dotnetbackend%2Farm-template.json) 

This button will deploy a new DFM instance into your Azure Subscription from a zipped package taken from [one of the recent releases](https://github.com/scale-tone/DurableFunctionsMonitor/releases). NOTE: the instance will be deployed to the selected Resource Group's location. The default **Region** parameter in Azure Portal's *Deploy from a custom template* wizard has no effect here. It only defines where the deployment metadata will be stored, so feel free to leave it to default.

**OR**

* Get the sources (either via **git clone** or by just downloading the ZIP-file) from this repo.
* Open command line in **durablefunctionsmonitor.dotnetbackend** folder.
* Run **node setup-and-run.js**. This setup script will ask you to provide the Connection String to your Azure Storage and the Hub Name, that your existing Durable Functions are using, and put it into **local.settings.json** file. Then it will run the Functions project (do the **func start**) and open the UI page (http://localhost:7072) in your favourite browser. If not, then just navigate to that URL yourself (on a Mac it is reported to be more preferrable to open http://127.0.0.1:7072 instead).
* Alternatively you can just create **local.settings.json** file yourself, then run **func start** and open the UI page in your browser manually.

**OR**

Run [this Docker container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) locally:
* **docker pull scaletone/durablefunctionsmonitor:[put-latest-tag-here]**
* **docker run -p 7072:80 -e AzureWebJobsStorage="your-azure-storage-connection-string" -e DFM_HUB_NAME="your-hub-name" scaletone/durablefunctionsmonitor:[put-latest-tag-here]**
* Navigate to http://localhost:7072

**OR**

Deploy to your own Azure Function instance (separate from where your Durable Functions are running) and **protect** it with [Easy Auth and AAD](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization) (NOTE: AAD login support and token validation added starting from **v.1.1.0**).

* Create a new AAD app (*Azure Portal->Azure Active Directory->App Registrations*).
* On *Authentication* tab add a *Redirect URI* (should be like 'https://your-function-app.azurewebsites.net') and enable *ID tokens* **and** *Access tokens*.
* Create a new Function App instance with *.Net Core* stack and setup *Easy Auth* with *AAD in Advanced Mode* for it. Specify your AAD app's Client ID and 'https://login.microsoftonline.com/your-tenant-id/v2.0' as *Issuer Url*. Also set *Action to take when request is not authenticated* to *Allow anonymous requests (no action)* (since statics are hosted by the same endpoint, they should be accessible without authentication).
* Set **AzureWebJobsStorage** configuration setting to the correct Azure Storage instance (the one that's being used by your Durable Functions).
* Set **DFM_HUB_NAME** configuration setting to the Hub Name that's being used by your Durable Functions.
* Open **durablefunctionsmonitor.dotnetbackend** folder with Visual Studio Code and deploy it to your Function App instance.
* **IMPORTANT:** so far **any** user of your tenant can login to your freshly deployed Durable Functions Monitor. To restrict the list of allowed users you have two options:

    For your AAD app set *User Assignment Required* to *Yes* and explicitly add whitelisted users/groups via *Users and groups* tab. WARNING: this option might lead to your users faced with *Administrator's Consent Required* error page, when they try to login (in which case you'll need to provide that Administrator's Consent...).
    
    **OR**
    
    Add **DFM_ALLOWED_USER_NAMES** configuration setting with a comma-separated list of emails. The backend then [will only allow users from this list to call itself](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Common/Globals.cs#L90).
* Navigate to https://your-function-app.azurewebsites.net and ensure you can login (and unwelcomed ones cannot).


## Details

The backend is a C#-written Azure Function itself, that leverages [Durable Functions management interface](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-instance-management) and adds paging/filtering/sorting/etc. capabilities on top of it. UI is a set of static build artifacts from [this project](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.react), committed into [this folder](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.dotnetbackend/wwwroot) and served by [this function](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Functions/Monitor.cs). 

By default, Azure Functions runtime exposes a /runtime/webhooks/durabletask endpoint, which (when running locally) doesn't have any auth and returns quite sensitive data. That endpoint is being suppressed via [proxies.json](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/proxies.json). Still, when running on your devbox, please, ensure that the HTTP port you're using is not accessible externally.

When this backend is run as part of [VsCode extension](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor-vscodeext), it's being [protected with a random nonce](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Common/Globals.cs#L65), so that nobody else could make calls to it except your VsCode instance.

Technically, nothing prevents you from deploying and hosting this management tool in Azure under your own Azure Function instance, but in that case it **must** be secured with [Easy Auth](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization). Support for AAD login was added to **v.1.1.0** (client side [signs the user in and obtains an access token](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.react/src/states/LoginState.ts), backend [validates the token and the user](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Common/Globals.cs#L62)), but it needs to be configured properly, as described above.

You can also protect the backend's RESTful API with **DFM_NONCE** config setting. Pass a *long-enough* random string as a setting with that name - and the API will expect that random string to be sent via **x-dfm-nonce** HTTP header with every request. The UI will stop working though.

Enjoy and please report any bugs.

## Known Issues

* Beware of [this Docker Desktop trouble](https://forums.docker.com/t/docker-for-windows-10-time-out-of-sync/21506). Whenever your laptop goes to sleep, time might freeze inside your containers. Which forces all outgoing HTTPS connections to fail due to a big time lag, so everything just breaks. If after starting the container you only see "function host is not running" error in your browser, then try to restart your Docker Desktop.

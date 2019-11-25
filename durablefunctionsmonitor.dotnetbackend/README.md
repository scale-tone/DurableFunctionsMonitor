# DurableFunctionsMonitor.DotNetBackend

Backend for DurableFunctionsMonitor, reimplemented in C#. Also serves the UI statics (at http://localhost:7072/api/monitor).
Use this project as a standalone service, either run it locally or deploy to Azure (and **protect** with AAD).

## How to run

* Get the sources (either via **git clone** or by just downloading the ZIP-file) from this repo.
* Open command line in **durablefunctionsmonitor.dotnetbackend** folder.
* Run **node setup-and-run.js**. This setup script will ask you to provide the Connection String to your Azure Storage, that your existing Durable Functions are using, and put it into **local.settings.json** file. Then it will run the Functions project (do the **func start**) and open the UI page (http://localhost:7072/api/monitor) in your favourite browser. If not, then just navigate to that URL yourself (on a Mac it is reported to be more preferrable to open http://127.0.0.1:7072/api/monitor instead).
* Alternatively you can just create **local.settings.json** file yourself, then run **func start** and open the UI page in your browser manually.

**OR**

Run [this Docker container](https://hub.docker.com/r/scaletone/durablefunctionsmonitor) locally:
* **docker pull scaletone/durablefunctionsmonitor:1.3**
* **docker run -p 7072:80 -e AzureWebJobsStorage="your-azure-storage-connection-string" scaletone/durablefunctionsmonitor:1.3**
* Navigate to http://localhost:7072/api/monitor

**OR**

Deploy to your own Azure Function instance (separate from where your Durable Functions are running) and **protect** it with [Easy Auth and AAD](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization) (NOTE: AAD login support and token validation added starting from **v.1.1.0**).

* Create a new AAD app (*Azure Portal->Azure Active Directory->App Registrations*).
* On *Authentication* tab add a *Redirect URI* (should be like 'https://your-function-app.azurewebsites.net/api/monitor') and enable *ID tokens* **and** *Access tokens*.
* Create a new Function App instance with *Node.js* stack and setup *Easy Auth* with *AAD in Advanced Mode* for it. Specify your AAD app's Client ID and 'https://login.microsoftonline.com/your-tenant-id/v2.0' as *Issuer Url*. Also set *Action to take when request is not authenticated* to *Allow anonymous requests (no action)* (since statics are hosted by the same endpoint, they should be accessible without authentication).
* Set **AzureWebJobsStorage** configuration setting to the correct Azure Storage instance (the one that's being used by your Durable Functions).
* Open **durablefunctionsmonitor.functions** folder with Visual Studio Code and deploy it to your Function App instance.
* **IMPORTANT:** so far **any** user of your tenant can login to your freshly deployed Durable Functions Monitor. To restrict the list of allowed users you have two options:

    For your AAD app set *User Assignment Required* to *Yes* and explicitly add whitelisted users/groups via *Users and groups* tab. WARNING: this option might lead to your users faced with *Administrator's Consent Required* error page, when they try to login (in which case you'll need to provide that Administrator's Consent...).
    
    **OR**
    
    Add **DFM_ALLOWED_USER_NAMES** configuration setting with a comma-separated list of emails. The backend then [will only allow users from this list to call itself](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Globals.cs#L43).
* Navigate to https://your-function-app.azurewebsites.net/api/monitor and ensure you can login (and unwelcomed ones cannot).


## Details

The backend is a C#-written Azure Function itself, that leverages [Durable Functions management interface](https://docs.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-instance-management) and adds paging/filtering/sorting/etc. capabilities on top of it. UI is a set of static build artifacts from [this project](https://github.com/scale-tone/DurableFunctionsMonitor/tree/master/durablefunctionsmonitor.react) served by [this function](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Monitor.cs).

By default, Azure Functions runtime exposes a /runtime/webhooks/durabletask endpoint, which (when running locally) doesn't have any auth and returns quite sensitive data. That endpoint is being suppressed via [proxies.json](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/proxies.json). Still, when running on your devbox, please, ensure that the HTTP port you're using is not accessible externally.

Technically, nothing prevents you from deploying and hosting this management tool in Azure under your own Azure Function instance, but in that case it **must** be secured with [Easy Auth](https://docs.microsoft.com/en-us/azure/app-service/overview-authentication-authorization). Support for AAD login was added to **v.1.1.0** (client side [signs the user in and obtains an access token](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.react/src/states/LoginState.ts), backend [validates the token and the user](https://github.com/scale-tone/DurableFunctionsMonitor/blob/master/durablefunctionsmonitor.dotnetbackend/Globals.cs#L15)), but it needs to be configured properly, as described above.

Enjoy and please report any bugs.

using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class ManageConnection
    {
        [FunctionName("manage-connection")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = null)] HttpRequest req,
            ExecutionContext executionContext)
        {
            // Checking that the call is authenticated properly
            try
            {
                Globals.ValidateIdentity(req.HttpContext.User, req.Headers);
            }
            catch (UnauthorizedAccessException ex)
            {
                return new OkObjectResult(ex.Message) { StatusCode = 401 };
            }

            string localSettingsFileName = Path.Combine(executionContext.FunctionAppDirectory, "local.settings.json");
            dynamic localSettings = File.Exists(localSettingsFileName) ? 
                JObject.Parse(await File.ReadAllTextAsync(localSettingsFileName)) : 
                new JObject();

            string hostFileName = Path.Combine(executionContext.FunctionAppDirectory, "host.json");
            dynamic host = JObject.Parse(await File.ReadAllTextAsync(hostFileName));

            string connectionString = localSettings.Values != null ? localSettings.Values.AzureWebJobsStorage : null;
            string hubName = host.extensions != null && host.extensions.durableTask != null ? 
                host.extensions.durableTask.HubName :
                "DurableFunctionsHub";

            if(req.Method == "GET")
            {
                return new JsonResult(new { connectionString, hubName }, Globals.SerializerSettings);
            }

            dynamic bodyObject = JObject.Parse(await req.ReadAsStringAsync());

            connectionString = bodyObject.connectionString;
            // only touching local.settings.json file, if connection string is not empty
            if(!string.IsNullOrEmpty(connectionString))
            {
                localSettings.Merge(JObject.Parse("{Values: {}}"));
                localSettings.Values.AzureWebJobsStorage = connectionString;
                await File.WriteAllTextAsync(localSettingsFileName, localSettings.ToString());
            }

            host.Merge(JObject.Parse("{extensions: {durableTask: {}}}"));
            host.extensions.durableTask.HubName = bodyObject.hubName;
            await File.WriteAllTextAsync(hostFileName, host.ToString());

            return new OkResult();
        }
    }
}

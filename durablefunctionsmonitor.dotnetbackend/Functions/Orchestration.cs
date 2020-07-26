using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Table;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Handles orchestration instance operations.
    // GET  /a/p/i/orchestrations('<id>')
    // POST /a/p/i/orchestrations('<id>')/purge
    // POST /a/p/i/orchestrations('<id>')/rewind
    // POST /a/p/i/orchestrations('<id>')/terminate
    // POST /a/p/i/orchestrations('<id>')/raise-event
    public static class Orchestration
    {
        [FunctionName("orchestration")]
        public static async Task<IActionResult> Run(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "a/p/i/orchestrations('{instanceId}')/{action?}")] HttpRequest req,
            string instanceId,
            string action,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient)
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

            if (req.Method == "GET")
            {
                var status = await durableClient.GetStatusAsync(instanceId, true, true, true);
                if(status == null)
                {
                    return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
                }

                return new ExpandedOrchestrationStatus(status, null).ToJsonContentResult(Globals.FixUndefinedsInJson);
            }

            string bodyString = await req.ReadAsStringAsync();

            switch(action)
            {
                case "purge":
                    await durableClient.PurgeInstanceHistoryAsync(instanceId);
                break;
                case "rewind":
                    await durableClient.RewindAsync(instanceId, bodyString);
                break;
                case "terminate":
                    await durableClient.TerminateAsync(instanceId, bodyString);
                break;
                case "raise-event":
                    dynamic bodyObject = JObject.Parse(bodyString);
                    string eventName = bodyObject.name;
                    JObject eventData = bodyObject.data;

                    await durableClient.RaiseEventAsync(instanceId, eventName, eventData);
                break;
                case "set-custom-status":

                    string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                    string hubName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);

                    // Updating the table directly, as there is no other known way
                    var tableClient = CloudStorageAccount.Parse(connectionString).CreateCloudTableClient();
                    var table = tableClient.GetTableReference($"{hubName}Instances");

                    var orcEntity = (await table.ExecuteAsync(TableOperation.Retrieve(instanceId, string.Empty))).Result as DynamicTableEntity;

                    if (string.IsNullOrEmpty(bodyString))
                    {
                        orcEntity.Properties.Remove("CustomStatus");
                    }
                    else
                    {
                        // Ensuring that it is at least a valid JSON
                        string customStatus = JObject.Parse(bodyString).ToString();
                        orcEntity.Properties["CustomStatus"] = new EntityProperty(customStatus);
                    }

                    await table.ExecuteAsync(TableOperation.Replace(orcEntity));

                    break;
                default:
                    return new NotFoundResult();
            }

            return new OkResult();
        }
    }
}

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
using System.Linq;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;
using DotLiquid;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Orchestration
    {
        // Handles orchestration instance operations.
        // GET  /a/p/i/orchestrations('<id>')
        [FunctionName("GetOrchestration")]
        public static async Task<IActionResult> GetOrchestration(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "a/p/i/orchestrations('{instanceId}')")] HttpRequest req,
            string instanceId,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient,
            ILogger log)
        {
            // Checking that the call is authenticated properly
            try
            {
                Auth.ValidateIdentity(req.HttpContext.User, req.Headers);
            }
            catch (UnauthorizedAccessException ex)
            {
                return new OkObjectResult(ex.Message) { StatusCode = 401 };
            }

            var status = await GetInstanceStatus(instanceId, durableClient, log);
            if (status == null)
            {
                return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
            }

            return status.ToJsonContentResult(Globals.FixUndefinedsInJson);
        }

        // Handles orchestration instance operations.
        // POST /a/p/i/orchestrations('<id>')/purge
        // POST /a/p/i/orchestrations('<id>')/rewind
        // POST /a/p/i/orchestrations('<id>')/terminate
        // POST /a/p/i/orchestrations('<id>')/raise-event
        // POST /a/p/i/orchestrations('<id>')/set-custom-status
        // POST /a/p/i/orchestrations('<id>')/restart
        [FunctionName("PostOrchestration")]
        public static async Task<IActionResult> PostOrchestration(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "a/p/i/orchestrations('{instanceId}')/{action?}")] HttpRequest req,
            string instanceId,
            string action,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient)
        {
            // Checking that the call is authenticated properly
            try
            {
                Auth.ValidateIdentity(req.HttpContext.User, req.Headers);
            }
            catch (UnauthorizedAccessException ex)
            {
                return new OkObjectResult(ex.Message) { StatusCode = 401 };
            }

            string bodyString = await req.ReadAsStringAsync();

            switch (action)
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
                // Not working yet because of https://github.com/Azure/azure-functions-durable-extension/issues/1592
                case "restart":
                    bool restartWithNewInstanceId = ((dynamic)JObject.Parse(bodyString)).restartWithNewInstanceId;

                    await durableClient.RestartAsync(instanceId, restartWithNewInstanceId);
                    break;
                default:
                    return new NotFoundResult();
            }

            return new OkResult();
        }

        // Renders a custom tab liquid template for this instance and returns the resulting HTML.
        // Why is it POST and not GET? Exactly: because we don't want to allow to navigate to this page directly (bypassing Content Security Policies)
        // POST /a/p/i/orchestrations('<id>')/custom-tab-markup
        [FunctionName("GetOrchestrationTabMarkup")]
        public static async Task<IActionResult> GetOrchestrationTabMarkup(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "a/p/i/orchestrations('{instanceId}')/custom-tab-markup('{templateName}')")] HttpRequest req,
            string instanceId,
            string templateName,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient,
            ILogger log)
        {
            // Checking that the call is authenticated properly
            try
            {
                Auth.ValidateIdentity(req.HttpContext.User, req.Headers);
            }
            catch (UnauthorizedAccessException ex)
            {
                return new OkObjectResult(ex.Message) { StatusCode = 401 };
            }

            var status = await GetInstanceStatus(instanceId, durableClient, log);
            if (status == null)
            {
                return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
            }

            // The underlying Task never throws, so it's OK.
            var templatesMap = DetailedOrchestrationStatus.TabTemplatesTask.Result;

            string templateCode = templatesMap.GetTemplate(status.GetEntityTypeName(), templateName);
            if (templateCode == null)
            {
                return new NotFoundObjectResult("The specified template doesn't exist");
            }
            var liquidTemplate = Template.Parse(templateCode);

            // DotLiquid only accepts a dictionary of dictionaries as parameter.
            // So now making this weird set of transformations upon status object.
            var statusAsJObject = JObject.FromObject(status);
            var statusAsDictionary = (IDictionary<string, object>)statusAsJObject.ToDotLiquid();

            return new ContentResult()
            {
                Content = liquidTemplate.Render(Hash.FromDictionary(statusAsDictionary)),
                ContentType = "text/html; charset=UTF-8"
            };
        }

        private static async Task<DetailedOrchestrationStatus> GetInstanceStatus(string instanceId, IDurableClient durableClient, ILogger log)
        {
            // Also trying to load SubOrchestrations in parallel
            var subOrchestrationsTask = GetSubOrchestrationsAsync(instanceId);
            
            // Intentionally not awaiting and swallowing potential exceptions
            subOrchestrationsTask.ContinueWith(t => log.LogWarning(t.Exception, "Unable to load SubOrchestrations, but that's OK"),
                TaskContinuationOptions.OnlyOnFaulted);

            var status = await durableClient.GetStatusAsync(instanceId, true, true, true);
            if (status == null)
            {
                return null;
            }

            return new DetailedOrchestrationStatus(status, subOrchestrationsTask);
        }

        // Tries to get all SubOrchestration instanceIds for a given Orchestration
        private static async Task<IEnumerable<HistoryEntity>> GetSubOrchestrationsAsync(string instanceId)
        {
            // Querying the table directly, as there is no other known way
            string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
            string hubName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);

            var tableClient = CloudStorageAccount.Parse(connectionString).CreateCloudTableClient();
            var table = tableClient.GetTableReference($"{hubName}History");

            var query = new TableQuery<HistoryEntity>()
                .Where(TableQuery.CombineFilters(
                    TableQuery.GenerateFilterCondition("PartitionKey", QueryComparisons.Equal, instanceId),
                    TableOperators.And,
                    TableQuery.GenerateFilterCondition("EventType", QueryComparisons.Equal, "SubOrchestrationInstanceCreated")
                ));

            return (await table.GetAllAsync(query)).OrderBy(he => he._Timestamp);
        }

        // Translates a JToken (typically a JObject) to something that DotLiquid can understand
        private static object ToDotLiquid(this JToken token)
        {
            if (token.Type == JTokenType.Object)
            {
                var result = new Dictionary<string, object>();
                foreach (var kvp in (JObject)token)
                {
                    result[kvp.Key] = kvp.Value.ToDotLiquid();
                }
                return result;
            }

            if (token.Type == JTokenType.Array)
            {
                return ((JArray)token).Select(v => v.ToDotLiquid()).ToArray();
            }

            return token.ToObject<object>();
        }
    }
}

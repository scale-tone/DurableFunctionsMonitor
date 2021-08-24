using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.WindowsAzure.Storage.Table;
using System.Linq;
using System.Collections.Generic;
using Microsoft.Extensions.Logging;
using Fluid;
using Fluid.Values;
using Newtonsoft.Json;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Orchestration
    {
        // Handles orchestration instance operations.
        // GET /a/p/i/{taskHubName}/orchestrations('<id>')
        [FunctionName(nameof(DfmGetOrchestrationFunction))]
        public static Task<IActionResult> DfmGetOrchestrationFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/orchestrations('{instanceId}')")] HttpRequest req,
            string instanceId,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient durableClient,
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {

                var status = await durableClient.GetStatusAsync(instanceId, false, false, true);
                if (status == null)
                {
                    return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
                }

                return new DetailedOrchestrationStatus(status).ToJsonContentResult(Globals.FixUndefinedsInJson);
            });
        }

        // Handles orchestration instance operations.
        // GET /a/p/i/{taskHubName}/orchestrations('<id>')/history
        [FunctionName(nameof(DfmGetOrchestrationHistoryFunction))]
        public static Task<IActionResult> DfmGetOrchestrationHistoryFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/orchestrations('{instanceId}')/history")] HttpRequest req,
            string taskHubName,
            string instanceId,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient durableClient,
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {
                try
                {
                    var history = DfmEndpoint.ExtensionPoints.GetInstanceHistoryRoutine(durableClient, taskHubName, instanceId)
                        .ApplySkip(req.Query)
                        .ApplyTop(req.Query);

                    return new ContentResult()
                    {
                        Content = JsonConvert.SerializeObject(new { history }, HistorySerializerSettings),
                        ContentType = "application/json"
                    };
                } 
                catch (Exception ex)
                {
                    log.LogWarning(ex, "Failed to get execution history from storage, falling back to DurableClient");
                    return await GetHistoryFromDurableClientAsync(instanceId, req.Query, durableClient, log);
                }
            });
        }

        // Starts a new orchestration instance.
        // POST /a/p/i/{taskHubName}/orchestrations
        [FunctionName(nameof(DfmStartNewOrchestrationFunction))]
        public static Task<IActionResult> DfmStartNewOrchestrationFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Globals.ApiRoutePrefix + "/orchestrations")] HttpRequest req,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient durableClient, 
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {

                // Checking that we're not in ReadOnly mode
                if (DfmEndpoint.Settings.Mode == DfmMode.ReadOnly)
                {
                    log.LogError("Endpoint is in ReadOnly mode");
                    return new StatusCodeResult(403);
                }

                string bodyString = await req.ReadAsStringAsync();
                dynamic body = JObject.Parse(bodyString);

                string orchestratorFunctionName = body.name;
                string instanceId = body.id;

                instanceId = await durableClient.StartNewAsync(orchestratorFunctionName, instanceId, body.data);

                return new { instanceId }.ToJsonContentResult(Globals.FixUndefinedsInJson);
            });
        }

        // Handles orchestration instance operations.
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/purge
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/rewind
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/terminate
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/raise-event
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/set-custom-status
        // POST /a/p/i/{taskHubName}/orchestrations('<id>')/restart
        [FunctionName(nameof(DfmPostOrchestrationFunction))]
        public static Task<IActionResult> DfmPostOrchestrationFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Globals.ApiRoutePrefix + "/orchestrations('{instanceId}')/{action?}")] HttpRequest req,
            string instanceId,
            string action,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient durableClient, 
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {

                // Checking that we're not in ReadOnly mode
                if (DfmEndpoint.Settings.Mode == DfmMode.ReadOnly)
                {
                    log.LogError("Endpoint is in ReadOnly mode");
                    return new StatusCodeResult(403);
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

                        var match = ExpandedOrchestrationStatus.EntityIdRegex.Match(instanceId);
                        // if this looks like an Entity
                        if(match.Success)
                        {
                            // then sending signal
                            var entityId = new EntityId(match.Groups[1].Value, match.Groups[2].Value);

                            await durableClient.SignalEntityAsync(entityId, eventName, eventData);
                        }
                        else 
                        {
                            // otherwise raising event
                            await durableClient.RaiseEventAsync(instanceId, eventName, eventData);
                        }

                        break;
                    case "set-custom-status":

                        // Updating the table directly, as there is no other known way
                        var table = TableClient.GetTableClient().GetTableReference($"{durableClient.TaskHubName}Instances");

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
                    case "restart":
                        bool restartWithNewInstanceId = ((dynamic)JObject.Parse(bodyString)).restartWithNewInstanceId;

                        await durableClient.RestartAsync(instanceId, restartWithNewInstanceId);
                        break;
                    default:
                        return new NotFoundResult();
                }

                return new OkResult();
            });
        }

        // Renders a custom tab liquid template for this instance and returns the resulting HTML.
        // Why is it POST and not GET? Exactly: because we don't want to allow to navigate to this page directly (bypassing Content Security Policies)
        // POST /a/p/i{taskHubName}//orchestrations('<id>')/custom-tab-markup
        [FunctionName(nameof(DfmGetOrchestrationTabMarkupFunction))]
        public static Task<IActionResult> DfmGetOrchestrationTabMarkupFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Globals.ApiRoutePrefix + "/orchestrations('{instanceId}')/custom-tab-markup('{templateName}')")] HttpRequest req,
            string instanceId,
            string templateName,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient durableClient,
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {

                var status = await GetInstanceStatusWithHistory(instanceId, durableClient, log);
                if (status == null)
                {
                    return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
                }

                // The underlying Task never throws, so it's OK.
                var templatesMap = await CustomTemplates.GetTabTemplatesAsync();

                string templateCode = templatesMap.GetTemplate(status.GetEntityTypeName(), templateName);
                if (templateCode == null)
                {
                    return new NotFoundObjectResult("The specified template doesn't exist");
                }

                try
                {
                    var fluidTemplate = FluidTemplate.Parse(templateCode);
                    var fluidContext = new TemplateContext(status);

                    return new ContentResult()
                    {
                        Content = fluidTemplate.Render(fluidContext),
                        ContentType = "text/html; charset=UTF-8"
                    };
                }
                catch (Exception ex)
                {
                    return new BadRequestObjectResult(ex.Message);
                }
            });
        }

        static Orchestration()
        {
            // Some Fluent-related initialization
            TemplateContext.GlobalMemberAccessStrategy.Register<JObject, object>((obj, fieldName) => obj[fieldName]);
            FluidValue.SetTypeMapping(typeof(JObject), obj => new ObjectValue(obj));
            FluidValue.SetTypeMapping(typeof(JValue), obj => FluidValue.Create(((JValue)obj).Value));
        }

        private static readonly string[] SubOrchestrationEventTypes = new[]
        {
            "SubOrchestrationInstanceCreated",
            "SubOrchestrationInstanceCompleted",
            "SubOrchestrationInstanceFailed",
        };

        // Need special serializer settings for execution history, to match the way it was originally serialized
        private static JsonSerializerSettings HistorySerializerSettings = new JsonSerializerSettings
        {
            Formatting = Formatting.Indented,
            DateFormatString = "yyyy-MM-ddTHH:mm:ss.FFFFFFFZ"
        };

        private static async Task<DetailedOrchestrationStatus> GetInstanceStatusWithHistory(string instanceId, IDurableClient durableClient, ILogger log)
        {
            var status = await durableClient.GetStatusAsync(instanceId, true, true, true);
            if (status == null)
            {
                return null;
            }

            ConvertScheduledTime(status.History);

            return new DetailedOrchestrationStatus(status);
        }

        private static void ConvertScheduledTime(JArray history)
        {
            if (history == null)
            {
                return;
            }

            var orchestrationStartedEvent = history.FirstOrDefault(h => h.Value<string>("EventType") == "ExecutionStarted");

            foreach (var e in history)
            {
                if (e["ScheduledTime"] != null)
                {
                    // Converting to UTC and explicitly formatting as a string (otherwise default serializer outputs it as a local time)
                    var scheduledTime = e.Value<DateTime>("ScheduledTime").ToUniversalTime();
                    e["ScheduledTime"] = scheduledTime.ToString("o");

                    // Also adding DurationInMs field
                    var timestamp = e.Value<DateTime>("Timestamp").ToUniversalTime();
                    var duration = timestamp - scheduledTime;
                    e["DurationInMs"] = duration.TotalMilliseconds;
                }

                // Also adding duration of the whole orchestration
                if (e.Value<string>("EventType") == "ExecutionCompleted" && orchestrationStartedEvent != null)
                {
                    var scheduledTime = orchestrationStartedEvent.Value<DateTime>("Timestamp").ToUniversalTime();
                    var timestamp = e.Value<DateTime>("Timestamp").ToUniversalTime();
                    var duration = timestamp - scheduledTime;
                    e["DurationInMs"] = duration.TotalMilliseconds;
                }
            }
        }

        private static async Task<IActionResult> GetHistoryFromDurableClientAsync(string instanceId, IQueryCollection reqQuery, IDurableClient durableClient, ILogger log)
        {

            var status = await GetInstanceStatusWithHistory(instanceId, durableClient, log);
            if (status == null)
            {
                return new NotFoundObjectResult($"Instance {instanceId} doesn't exist");
            }

            var history = status.History == null ? new JArray() : status.History;
            var totalCount = history.Count;

            return new 
            {
                totalCount,
                history = history.ApplySkip(reqQuery).ApplyTop(reqQuery)
            }
            .ToJsonContentResult(Globals.FixUndefinedsInJson);
        }

        private static IEnumerable<T> ApplyTop<T>(this IEnumerable<T> history, IQueryCollection query)
        {
            var clause = query["$top"];
            return clause.Any() ? history.Take(int.Parse(clause)) : history;
        }
        private static IEnumerable<T> ApplySkip<T>(this IEnumerable<T> history, IQueryCollection query)
        {
            var clause = query["$skip"];
            return clause.Any() ? history.Skip(int.Parse(clause)) : history;
        }
    }
}
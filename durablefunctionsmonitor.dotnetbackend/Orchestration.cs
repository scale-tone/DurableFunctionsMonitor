using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System;
using Newtonsoft.Json;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Handles orchestration instance operations.
    // GET /api/orchestrations('<id>')
    // POST /api/orchestrations('<id>')/rewind
    // POST /api/orchestrations('<id>')/terminate
    // POST /api/orchestrations('<id>')/raise-event
    public static class Orchestration
    {
        [FunctionName("orchestration")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", Route = "orchestrations('{instanceId}')/{action?}")] HttpRequest req,
            string instanceId,
            string action,
            [OrchestrationClient] DurableOrchestrationClient orchestrationClient)
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
                var status = await orchestrationClient.GetStatusAsync(instanceId, true, true, true);

                string json = JsonConvert.SerializeObject(status, Globals.SerializerSettings)
                    .FixUndefinedsInJson();
                return new ContentResult() { Content = json, ContentType = "application/json" };
            }

            string bodyString = await req.ReadAsStringAsync();

            switch(action)
            {
                case "rewind":
                    await orchestrationClient.RewindAsync(instanceId, bodyString);
                break;
                case "terminate":
                    await orchestrationClient.TerminateAsync(instanceId, bodyString);
                break;
                case "raise-event":
                    dynamic bodyObject = JObject.Parse(bodyString);
                    string eventName = bodyObject.name;
                    JObject eventData = bodyObject.data;

                    await orchestrationClient.RaiseEventAsync(instanceId, eventName, eventData);
                break;
                default:
                    return new NotFoundResult();
            }

            return new OkResult();
        }
    }
}

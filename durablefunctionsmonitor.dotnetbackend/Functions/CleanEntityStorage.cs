using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Threading;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class CleanEntityStorage
    {
        // Request body
        class CleanEntityStorageRequest
        {
            public bool removeEmptyEntities { get; set; }
            public bool releaseOrphanedLocks { get; set; }
        }

        // Does garbage collection on Durable Entities
        // POST /a/p/i/{taskHubName}/clean-entity-storage
        [FunctionName(nameof(DfmCleanEntityStorageFunction))]
        public static Task<IActionResult> DfmCleanEntityStorageFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Globals.ApiRoutePrefix + "/clean-entity-storage")] HttpRequest req,
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

                var request = JsonConvert.DeserializeObject<CleanEntityStorageRequest>(await req.ReadAsStringAsync());

                var result = await durableClient.CleanEntityStorageAsync(request.removeEmptyEntities, request.releaseOrphanedLocks, CancellationToken.None);

                return result.ToJsonContentResult();
            });
        }
    }
}

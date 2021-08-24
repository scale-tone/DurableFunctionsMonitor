using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Linq;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Threading;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class IdSuggestions
    {
        // Returns a list of orchestration/entity IDs, that start with some prefix
        // GET /a/p/i/{taskHubName}/id-suggestions(prefix='{prefix}')
        [FunctionName(nameof(DfmGetIdSuggestionsFunction))]
        public static Task<IActionResult> DfmGetIdSuggestionsFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/id-suggestions(prefix='{prefix}')")] HttpRequest req,
            [DurableClient(TaskHub = Globals.TaskHubRouteParamName, ExternalClient = true)] IDurableClient durableClient,
            string prefix,
            ILogger log)
        {
            return req.HandleAuthAndErrors(durableClient.TaskHubName, log, async () => {

                var response = await durableClient.ListInstancesAsync(new OrchestrationStatusQueryCondition()
                    {
                        InstanceIdPrefix = prefix,
                        PageSize = 50,
                        ShowInput = false
                    }, 
                    CancellationToken.None);

                var orchestrationIds = response.DurableOrchestrationState.Select((s) => s.InstanceId);

                return orchestrationIds.ToJsonContentResult(Globals.FixUndefinedsInJson);
            });
        }
    }
}

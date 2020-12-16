using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Linq.Expressions;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Threading;
using Microsoft.WindowsAzure.Storage;
using Microsoft.WindowsAzure.Storage.Table;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class IdSuggestions
    {
        // Returns a list of orchestration/entity IDs, that start with some prefix
        // GET /a/p/i/id-suggestions(prefix='{prefix}')
        [FunctionName(nameof(GetIdSuggestionsFunction))]
        public static async Task<IActionResult> GetIdSuggestionsFunction(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "a/p/i/id-suggestions(prefix='{prefix}')")] HttpRequest req,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient,
            string prefix,
            ILogger log)
        {
            // Checking that the call is authenticated properly
            try
            {
                await Auth.ValidateIdentityAsync(req.HttpContext.User, req.Headers);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to authenticate request");
                return new UnauthorizedResult();
            }

            var response = await durableClient.ListInstancesAsync(new OrchestrationStatusQueryCondition()
                {
                    InstanceIdPrefix = prefix,
                    PageSize = 10,
                    ShowInput = false
                }, 
                CancellationToken.None);

            var orchestrationIds = response.DurableOrchestrationState.Select((s) => s.InstanceId);

            return orchestrationIds.ToJsonContentResult(Globals.FixUndefinedsInJson);
        }
    }
}

using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class TaskHubNames
    {
        // Returns all Task Hub names from the current Storage
        // GET /a/p/i/task-hub-names
        [FunctionName(nameof(DfmGetTaskHubNamesFunction))]
        public static async Task<IActionResult> DfmGetTaskHubNamesFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "a/p/i/task-hub-names")] HttpRequest req,
            ILogger log
        )
        {
            // Checking that the call is authenticated properly
            try
            {
                await Auth.ValidateIdentityAsync(req.HttpContext.User, req.Headers, null);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to authenticate request");
                return new UnauthorizedResult();
            }

            var hubNames = await Auth.GetAllowedTaskHubNamesAsync();
            if (hubNames == null)
            {
                return new ObjectResult("Failed to load the list of Task Hubs") { StatusCode = 500 };
            }
            return hubNames.ToJsonContentResult();
        }
    }
}
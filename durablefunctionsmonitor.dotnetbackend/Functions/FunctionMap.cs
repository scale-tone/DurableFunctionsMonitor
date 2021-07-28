using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class FunctionMap
    {
        // Tries to fetch a Function Map for a given Task Hub. 
        // Function Maps are specially formatted JSON files, they come either from a predefined folder
        // in the Blob Storage, or from a custom local folder.
        // GET /{taskHubName}/a/p/i/delete-task-hub
        [FunctionName(nameof(DfmGetFunctionMap))]
        public static async Task<IActionResult> DfmGetFunctionMap(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/function-map")] HttpRequest req,
            string taskHubName,
            ILogger log
        )
        {
            // Checking that the call is authenticated properly
            try
            {
                await Auth.ValidateIdentityAsync(req.HttpContext.User, req.Headers, taskHubName);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to authenticate request");
                return new UnauthorizedResult();
            }

            // The underlying Task never throws, so it's OK.
            var functionMapsMap = await CustomTemplates.GetFunctionMapsAsync();

            var functionMapJson = functionMapsMap.GetFunctionMap(taskHubName);
            if(string.IsNullOrEmpty(functionMapJson))
            {
                return new NotFoundObjectResult("No Function Map provided");
            }

            return new ContentResult()
            {
                Content = functionMapJson,
                ContentType = "application/json; charset=UTF-8"
            };
        }
    }
}
using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using DurableTask.AzureStorage;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class DeleteTaskHub
    {
        // Deletes all underlying storage resources for the Task Hub we're currently attached to.
        // GET /a/p/i/delete-task-hub
        [FunctionName(nameof(DeleteTaskHubFunction))]
        public static async Task<IActionResult> DeleteTaskHubFunction(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "a/p/i/delete-task-hub")] HttpRequest req,
            ILogger log
        )
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

            string hubName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);
            string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);

            var orcService = new AzureStorageOrchestrationService(new AzureStorageOrchestrationServiceSettings
            {
                StorageConnectionString = connectionString,
                TaskHubName = hubName,
            });

            // .DeleteAsync() tends to throw "The requested operation cannot be performed on this container because of a concurrent operation"
            // (though still seems to do its job). So just wrapping with try-catch
            try
            {
                await orcService.DeleteAsync();
            }
            catch(Exception ex)
            {
                log.LogError(ex, "AzureStorageOrchestrationService.DeleteAsync() failed");
            }

            return new OkResult();
        }
    }
}
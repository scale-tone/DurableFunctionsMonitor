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
        // Deletes all underlying storage resources for a Task Hub.
        // GET /{taskHubName}/a/p/i/delete-task-hub
        [FunctionName(nameof(DfmDeleteTaskHubFunction))]
        public static async Task<IActionResult> DfmDeleteTaskHubFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = Globals.ApiRoutePrefix + "/delete-task-hub")] HttpRequest req,
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

            string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);

            var orcService = new AzureStorageOrchestrationService(new AzureStorageOrchestrationServiceSettings
            {
                StorageConnectionString = connectionString,
                TaskHubName = taskHubName,
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
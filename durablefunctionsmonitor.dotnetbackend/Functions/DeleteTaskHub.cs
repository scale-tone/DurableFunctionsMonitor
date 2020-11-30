using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using DurableTask.AzureStorage;
using System.Threading.Tasks;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class DeleteTaskHub
    {
        // Deletes all underlying storage resources for the Task Hub we're currently attached to.
        // GET /a/p/i/delete-task-hub
        [FunctionName("delete-task-hub")]
        public static async Task<IActionResult> Run(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "a/p/i/delete-task-hub")] HttpRequest req
        )
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

            string hubName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);
            string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);

            var orcService = new AzureStorageOrchestrationService(new AzureStorageOrchestrationServiceSettings
            {
                StorageConnectionString = connectionString,
                TaskHubName = hubName,
            });

            await orcService.DeleteAsync();

            return new OkResult();
        }
    }
}
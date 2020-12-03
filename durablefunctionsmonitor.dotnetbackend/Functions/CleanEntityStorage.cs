using System;
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
        // POST /a/p/i/clean-entity-storage
        [FunctionName("clean-entity-storage")]
        public static async Task<IActionResult> Run(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "a/p/i/clean-entity-storage")] HttpRequest req,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient, 
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

            var request = JsonConvert.DeserializeObject<CleanEntityStorageRequest>(await req.ReadAsStringAsync());

            var result = await durableClient.CleanEntityStorageAsync(request.removeEmptyEntities, request.releaseOrphanedLocks, CancellationToken.None);

            return result.ToJsonContentResult();
        }
    }
}

using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using DurableTask.Core;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class PurgeHistory
    {
        // Request body
        class PurgeHistoryRequest
        {
            public string TimeFrom { get; set; }
            public string TimeTill { get; set; }
            public OrchestrationStatus[] Statuses { get; set; }
            public EntityTypeEnum EntityType { get; set; }
        }

        // Purges orchestration instance history
        // POST /api/purge-history
        [FunctionName("purge-history")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequest req,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient)
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

            // Important to deserialize time fields as strings, because otherwize time zone will appear to be local
            var request = JsonConvert.DeserializeObject<PurgeHistoryRequest>(await req.ReadAsStringAsync());

            var result = request.EntityType == EntityTypeEnum.DurableEntity ?
                await durableClient.PurgeDurableEntitiesHistory(DateTime.Parse(request.TimeFrom),
                    DateTime.Parse(request.TimeTill)) :
                await durableClient.PurgeOrchestrationsHistory(DateTime.Parse(request.TimeFrom),
                    DateTime.Parse(request.TimeTill), request.Statuses);

            return result.ToJsonContentResult();
        }

        private static Task<PurgeHistoryResult> PurgeOrchestrationsHistory(
            this IDurableClient durableClient, 
            DateTime timeFrom, 
            DateTime timeTill, 
            OrchestrationStatus[] statuses)
        {
            return durableClient.PurgeInstanceHistoryAsync(timeFrom, timeTill, statuses);
        }

        private static async Task<PurgeHistoryResult> PurgeDurableEntitiesHistory(
            this IDurableClient durableClient,
            DateTime timeFrom,
            DateTime timeTill)
        {

            // The only known way of retrieving Durable Entities _only_ is to ask for running instances
            // (because Durable Entities are always "Running") and then check their InstanceIds for two at signs in them.
            var entities = (await durableClient.GetStatusAsync(
                timeFrom, timeTill,
                new OrchestrationRuntimeStatus[] { OrchestrationRuntimeStatus.Running }
            ))
            .Where(en => ExpandedOrchestrationStatus.EntityIdRegex.Match(en.InstanceId).Success);

            int instancesDeleted = 0;

            foreach(var entity in entities)
            {
                await durableClient.PurgeInstanceHistoryAsync(entity.InstanceId);
                instancesDeleted++;
            }

            return new PurgeHistoryResult(instancesDeleted);
        }
    }
}

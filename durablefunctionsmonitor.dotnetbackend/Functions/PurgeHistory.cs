using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using DurableTask.Core;

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
        }

        // Purges orchestration instance history
        // POST /api/purge-history
        [FunctionName("purge-history")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = null)] HttpRequest req,
            [OrchestrationClient] DurableOrchestrationClient orchestrationClient)
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

            var result = await orchestrationClient.PurgeInstanceHistoryAsync(DateTime.Parse(request.TimeFrom),
                DateTime.Parse(request.TimeTill), request.Statuses);

            return new JsonResult(result, Globals.SerializerSettings);
        }
    }
}

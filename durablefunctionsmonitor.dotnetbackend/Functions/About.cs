using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;
using System.Reflection;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class About
    {
        // Returns short connection info and backend version
        // GET /api/about
        [FunctionName("about")]
        public static IActionResult Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)] HttpRequest req,
            [OrchestrationClient] DurableOrchestrationClient orchestrationClient
        )
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

            string accountName = string.Empty;
            var match = AccountNameRegex.Match(Environment.GetEnvironmentVariable("AzureWebJobsStorage"));
            if (match.Success)
            {
                accountName = match.Groups[1].Value;
            }

            return new JsonResult(new {
                    accountName,
                    hubName = orchestrationClient.TaskHubName,
                    version = Assembly.GetExecutingAssembly().GetName().Version.ToString()
                }, 
                Globals.SerializerSettings);
        }

        private static readonly Regex AccountNameRegex = new Regex(@"AccountName=(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
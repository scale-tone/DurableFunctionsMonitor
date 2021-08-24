using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class About
    {
        // Returns short connection info and backend version. 
        // GET /a/p/i/{taskHubName}/about
        [FunctionName(nameof(DfmAboutFunction))]
        public static Task<IActionResult> DfmAboutFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/about")] HttpRequest req,
            string taskHubName,
            ILogger log
        )
        {
            return req.HandleAuthAndErrors(taskHubName, log, async () => {

                string accountName = string.Empty;
                var match = AccountNameRegex.Match(Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage));
                if (match.Success)
                {
                    accountName = match.Groups[1].Value;
                }

                return new 
                {
                    accountName,
                    hubName = taskHubName,
                    version = Assembly.GetExecutingAssembly().GetName().Version.ToString()
                }
                .ToJsonContentResult();
            });
        }

        private static readonly Regex AccountNameRegex = new Regex(@"AccountName=(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
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
        // GET /a/p/i/{connAndTaskHub}/about
        [FunctionName(nameof(DfmAboutFunction))]
        public static Task<IActionResult> DfmAboutFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/about")] HttpRequest req,
            string connAndTaskHub,
            ILogger log
        )
        {
            return req.HandleAuthAndErrors(connAndTaskHub, log, async () => {

                string accountName = string.Empty;

                string storageConnString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                var match = AccountNameRegex.Match(storageConnString ?? string.Empty);
                if (match.Success)
                {
                    accountName = match.Groups[1].Value;
                }

                return new 
                {
                    accountName,
                    hubName = connAndTaskHub,
                    version = Assembly.GetExecutingAssembly().GetName().Version.ToString()
                }
                .ToJsonContentResult();
            });
        }

        private static readonly Regex AccountNameRegex = new Regex(@"AccountName=(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
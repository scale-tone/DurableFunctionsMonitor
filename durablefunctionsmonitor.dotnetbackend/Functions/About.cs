using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class About
    {
        // Returns short connection info and backend version. 
        // GET /a/p/i/about
        [FunctionName(nameof(AboutFunction))]
        public static async Task<IActionResult> AboutFunction(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "a/p/i/about")] HttpRequest req,
            [DurableClient(TaskHub = "%DFM_HUB_NAME%")] IDurableClient durableClient,
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

            string accountName = string.Empty;
            var match = AccountNameRegex.Match(Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage));
            if (match.Success)
            {
                accountName = match.Groups[1].Value;
            }

            return new 
            {
                accountName,
                hubName = durableClient.TaskHubName,
                version = Assembly.GetExecutingAssembly().GetName().Version.ToString()
            }
            .ToJsonContentResult();
        }

        private static readonly Regex AccountNameRegex = new Regex(@"AccountName=(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
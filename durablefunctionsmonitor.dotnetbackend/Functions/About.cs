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
        [FunctionName(nameof(AboutFunction))]
        public static async Task<IActionResult> AboutFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/about")] HttpRequest req,
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
        }

        private static readonly Regex AccountNameRegex = new Regex(@"AccountName=(\w+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
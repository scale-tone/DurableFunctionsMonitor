using System;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;
using System.Text.RegularExpressions;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Gets/sets Storage Connection String and Hub Name
    // GET /a/p/i/manage-connection
    // PUT /a/p/i/manage-connection
    public static class ManageConnection
    {
        [FunctionName("manage-connection")]
        public static async Task<IActionResult> Run(
            // Using /a/p/i route prefix, to let Functions Host distinguish api methods from statics
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "put", Route = "a/p/i/manage-connection")] HttpRequest req,
            ExecutionContext executionContext)
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

            string localSettingsFileName = Path.Combine(executionContext.FunctionAppDirectory, "local.settings.json");

            if(req.Method == "GET")
            {
                bool isRunningOnAzure = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_SITE_NAME));
                // Don't allow editing, when running in Azure or as a container
                bool isReadOnly = isRunningOnAzure || !File.Exists(localSettingsFileName);

                string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                // No need for your accountKey to ever leave the server side
                connectionString = AccountKeyRegex.Replace(connectionString, "AccountKey=*****");

                string hubName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);

                return new { connectionString, hubName, isReadOnly }.ToJsonContentResult();
            }
            else
            {
                dynamic bodyObject = JObject.Parse(await req.ReadAsStringAsync());

                string connectionString = bodyObject.connectionString;
                string hubName = bodyObject.hubName;

                // local.settings.json file does should already exist
                dynamic localSettings = JObject.Parse(await File.ReadAllTextAsync(localSettingsFileName));

                localSettings.Merge(JObject.Parse("{Values: {}}"));
                localSettings.Values.DFM_HUB_NAME = hubName;
                if (!string.IsNullOrEmpty(connectionString))
                {
                    localSettings.Values.AzureWebJobsStorage = connectionString;
                }

                await File.WriteAllTextAsync(localSettingsFileName, localSettings.ToString());

                return new OkResult();
            }
        }

        private static readonly Regex AccountKeyRegex = new Regex(@"AccountKey=[^;]+", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}

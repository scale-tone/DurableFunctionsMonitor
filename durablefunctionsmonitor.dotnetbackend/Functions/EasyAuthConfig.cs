using System;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Text.RegularExpressions;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class EasyAuthConfig
    {
        // Returns EasyAuth configuration settings, specifically the AAD app's Client ID (which is not a secret)
        // GET /a/p/i/easyauth-config
        [FunctionName(nameof(EasyAuthConfigFunction))]
        public static IActionResult EasyAuthConfigFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "a/p/i/easyauth-config")] HttpRequest req
        )
        {
            string siteName = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_SITE_NAME);
            string clientId = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_CLIENT_ID);

            // When deployed to Azure, this tool should always be protected by EasyAuth
            if(!string.IsNullOrEmpty(siteName) && string.IsNullOrEmpty(clientId))
            {
                return new ObjectResult($"You need to configure EasyAuth for your '{siteName}' instance. This tool should never be exposed to the world without authentication.") 
                {
                    StatusCode = 401 
                };
            }

            // Trying to get tenantId from WEBSITE_AUTH_OPENID_ISSUER environment variable
            string tenantId = "common";
            string openIdIssuer = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER);
            if(!string.IsNullOrEmpty(openIdIssuer))
            {
                var match = GuidRegex.Match(openIdIssuer);
                if(match.Success)
                {
                    tenantId = match.Groups[1].Value;
                }
            }

            return new { clientId, authority = "https://login.microsoftonline.com/" + tenantId }.ToJsonContentResult();
        }

        private static readonly Regex GuidRegex = new Regex(@"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", RegexOptions.IgnoreCase | RegexOptions.Compiled);
    }
}
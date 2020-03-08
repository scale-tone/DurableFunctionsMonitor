
using System;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using Newtonsoft.Json.Serialization;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class EnvVariableNames
    {
        public const string AzureWebJobsStorage = "AzureWebJobsStorage";
        public const string WEBSITE_SITE_NAME = "WEBSITE_SITE_NAME";
        public const string WEBSITE_AUTH_CLIENT_ID = "WEBSITE_AUTH_CLIENT_ID";
        public const string WEBSITE_AUTH_OPENID_ISSUER = "WEBSITE_AUTH_OPENID_ISSUER";
        public const string DFM_ALLOWED_USER_NAMES = "DFM_ALLOWED_USER_NAMES";
        public const string DFM_HUB_NAME = "DFM_HUB_NAME";
    }

    public static class Globals
    {        
        // Validates that the incoming request is properly authenticated
        public static void ValidateIdentity(ClaimsPrincipal principal, IHeaderDictionary headers)
        {
            // Also validating nonce (used when running as a VsCode extension)
            string nonce = Environment.GetEnvironmentVariable("DFM_NONCE");
            if(!string.IsNullOrEmpty(nonce) && nonce != headers["x-dfm-nonce"])
            {
                throw new UnauthorizedAccessException("Invalid nonce. Call is rejected.");
            }

            string siteName = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_SITE_NAME);

            var userNameClaim = principal.FindFirst("preferred_username");
            if(userNameClaim == null)
            {
                if(string.IsNullOrEmpty(siteName))
                {
                    // Running on localhost, skipping identity validation
                    return;
                }

                throw new UnauthorizedAccessException("'preferred_username' claim is missing in the incoming identity. Call is rejected.");
            }

            if(string.IsNullOrEmpty(siteName))
            {
                throw new UnauthorizedAccessException("Looks like you are hosting the tool in Azure, but 'WEBSITE_SITE_NAME' environment variable is missing. Check your App Service configuration.");
            }

            string allowedUserNames = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES);
            if(!string.IsNullOrEmpty(allowedUserNames))
            {
                if(!allowedUserNames.Split(',').Contains(userNameClaim.Value))
                {
                    throw new UnauthorizedAccessException($"User {userNameClaim.Value} is not mentioned in {EnvVariableNames.DFM_ALLOWED_USER_NAMES} config setting. Call is rejected");
                }
            }
        }

        // Fighting with https://github.com/Azure/azure-functions-durable-js/issues/94
        // Could use a custom JsonConverter, but it won't be invoked for nested items :(
        public static string FixUndefinedsInJson(this string json)
        {
            return json.Replace("\": undefined", "\": null");
        }

        // Shared JSON serialization settings
        public static JsonSerializerSettings SerializerSettings = GetSerializerSettings();

        // A customized way of returning JsonResult, to cope with Functions v2/v3 incompatibility
        public static ContentResult ToJsonContentResult(this object result, Func<string, string> applyThisToJson = null)
        {
            string json = JsonConvert.SerializeObject(result, Globals.SerializerSettings);
            if(applyThisToJson != null)
            {
                json = applyThisToJson(json);
            }
            return new ContentResult() { Content = json, ContentType = "application/json" };
        }

        private static JsonSerializerSettings GetSerializerSettings()
        {
            var settings = new JsonSerializerSettings
            {
                Formatting = Formatting.Indented,
                DateFormatString = "yyyy-MM-ddTHH:mm:ssZ",
                ContractResolver = new CamelCasePropertyNamesContractResolver()
            };
            settings.Converters.Add(new StringEnumConverter());
            return settings;
        }
    }
}
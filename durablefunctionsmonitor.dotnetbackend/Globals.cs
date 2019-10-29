
using System;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using Newtonsoft.Json.Serialization;

namespace DurableFunctionsMonitor.DotNetBackend
{
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

            // More auth coming...
        }

        // Fighting with https://github.com/Azure/azure-functions-durable-js/issues/94
        // Could use a custom JsonConverter, but it won't be invoked for nested items :(
        public static string FixUndefinedsInJson(this string json)
        {
            return json.Replace("\": undefined", "\": null");
        }

        // Shared JSON serialization settings
        public static JsonSerializerSettings SerializerSettings = GetSerializerSettings();

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
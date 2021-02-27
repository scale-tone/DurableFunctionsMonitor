
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.WindowsAzure.Storage.Blob;
using Microsoft.WindowsAzure.Storage.Table;
using Newtonsoft.Json;
using Newtonsoft.Json.Converters;
using Newtonsoft.Json.Serialization;
using System.Runtime.CompilerServices;

[assembly: InternalsVisibleToAttribute("durablefunctionsmonitor.dotnetbackend.tests")]

namespace DurableFunctionsMonitor.DotNetBackend
{
    static class EnvVariableNames
    {
        public const string AzureWebJobsStorage = "AzureWebJobsStorage";
        public const string WEBSITE_SITE_NAME = "WEBSITE_SITE_NAME";
        public const string WEBSITE_AUTH_CLIENT_ID = "WEBSITE_AUTH_CLIENT_ID";
        public const string WEBSITE_AUTH_OPENID_ISSUER = "WEBSITE_AUTH_OPENID_ISSUER";
        public const string DFM_ALLOWED_USER_NAMES = "DFM_ALLOWED_USER_NAMES";
        public const string DFM_HUB_NAME = "DFM_HUB_NAME";
        public const string DFM_NONCE = "DFM_NONCE";
        public const string DFM_CLIENT_CONFIG = "DFM_CLIENT_CONFIG";
    }

    static class Globals
    {
        public const string TemplateContainerName = "durable-functions-monitor";
        public const string TabTemplateFolderName = "tab-templates/";
        public const string CustomMetaTag = "<meta name=\"durable-functions-monitor-meta\">";
        public const string CustomMetaTagBlobName = "custom-meta-tag.htm";

        public const string TaskHubRouteParamName = "{taskHubName}";

        // Constant, that defines the /a/p/i/{taskHubName} route prefix, to let Functions Host distinguish api methods from statics
        public const string ApiRoutePrefix = "a/p/i/{taskHubName}";

        // Lists all blobs from Azure Blob Container
        public static async Task<IEnumerable<IListBlobItem>> ListBlobsAsync(this CloudBlobContainer container, string prefix)
        {
            var result = new List<IListBlobItem>();
            BlobContinuationToken token = null;
            do
            {
                var nextBatch = await container.ListBlobsSegmentedAsync(prefix, token);
                result.AddRange(nextBatch.Results);
                token = nextBatch.ContinuationToken;
            }
            while (token != null);
            return result;
        }

        // Retrieves all results from Azure Table
        public static async Task<IEnumerable<TEntity>> GetAllAsync<TEntity>(this CloudTable table, TableQuery<TEntity> query)
            where TEntity: TableEntity, new()
        {
            var result = new List<TEntity>();
            TableContinuationToken token = null;
            do
            {
                var nextBatch = await table.ExecuteQuerySegmentedAsync(query, token);
                result.AddRange(nextBatch.Results);
                token = nextBatch.ContinuationToken;
            } 
            while (token != null);

            return result;
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
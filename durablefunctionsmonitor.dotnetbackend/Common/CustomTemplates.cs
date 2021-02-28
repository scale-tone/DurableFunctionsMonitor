using System;
using System.Threading.Tasks;
using System.Linq;
using System.Collections.Generic;
using Microsoft.WindowsAzure.Storage;
using System.IO;
using System.Text;
using System.Collections.Concurrent;
using System.Reflection;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Contains all logic of loading custom tab/html templates
    class CustomTemplates
    {
        internal static Task<LiquidTemplatesMap> GetTabTemplatesAsync()
        {
            if (TabTemplatesTask == null)
            {
                TabTemplatesTask = string.IsNullOrEmpty(DfmEndpoint.Settings.CustomTemplatesFolderName) ?
                    GetTabTemplatesFromStorageAsync() : GetTabTemplatesFromFolderAsync(DfmEndpoint.Settings.CustomTemplatesFolderName);
            }

            return TabTemplatesTask;
        }

        internal static Task<string> GetCustomMetaTagCodeAsync()
        {
            if (CustomMetaTagCodeTask == null)
            {
                CustomMetaTagCodeTask = string.IsNullOrEmpty(DfmEndpoint.Settings.CustomTemplatesFolderName) ?
                    GetCustomMetaTagCodeFromStorageAsync() : GetCustomMetaTagCodeFromFolderAsync(DfmEndpoint.Settings.CustomTemplatesFolderName);
            }

            return CustomMetaTagCodeTask;
        }

        // Yes, it is OK to use Task in this way.
        // The Task code will only be executed once. All subsequent/parallel awaits will get the same returned value.
        // Tasks do have the same behavior as Lazy<T>.
        private static Task<LiquidTemplatesMap> TabTemplatesTask;

        private static Task<string> CustomMetaTagCodeTask;


        // Tries to load liquid templates from underlying Azure Storage
        private static async Task<LiquidTemplatesMap> GetTabTemplatesFromStorageAsync()
        {
            var result = new LiquidTemplatesMap();
            try
            {
                string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                var blobClient = CloudStorageAccount.Parse(connectionString).CreateCloudBlobClient();

                // Listing all blobs in durable-functions-monitor/tab-templates folder
                var container = blobClient.GetContainerReference(Globals.TemplateContainerName);

                string templateFolderName = Globals.TabTemplateFolderName + "/";
                var templateNames = await container.ListBlobsAsync(templateFolderName);

                // Loading blobs in parallel
                await Task.WhenAll(templateNames.Select(async templateName =>
                {
                    var blob = await blobClient.GetBlobReferenceFromServerAsync(templateName.Uri);

                    // Expecting the blob name to be like "[Tab Name].[EntityTypeName].liquid" or just "[Tab Name].liquid"
                    var nameParts = blob.Name.Substring(templateFolderName.Length).Split('.');
                    if (nameParts.Length < 2 || nameParts.Last() != "liquid")
                    {
                        return;
                    }

                    string tabName = nameParts[0];
                    string entityTypeName = nameParts.Length > 2 ? nameParts[1] : string.Empty;

                    using (var stream = new MemoryStream())
                    {
                        await blob.DownloadToStreamAsync(stream);
                        string templateText = Encoding.UTF8.GetString(stream.ToArray());

                        result.GetOrAdd(entityTypeName, new ConcurrentDictionary<string, string>())[tabName] = templateText;
                    }
                }));
            } 
            catch (Exception)
            {
                // Intentionally swallowing all exceptions here
            }
            return result;
        }

        // Tries to load liquid templates from local folder
        private static async Task<LiquidTemplatesMap> GetTabTemplatesFromFolderAsync(string folderName)
        {
            var result = new LiquidTemplatesMap();

            string binFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string templatesFolder = Path.Combine(binFolder, "..", folderName, Globals.TabTemplateFolderName);

            if (!Directory.Exists(templatesFolder))
            {
                return result;
            }

            foreach(var templateFilePath in Directory.EnumerateFiles(templatesFolder, "*.liquid"))
            {
                var nameParts = Path.GetFileName(templateFilePath).Split('.');
                if(nameParts.Length < 2)
                {
                    continue;
                }

                string tabName = nameParts[0];
                string entityTypeName = nameParts.Length > 2 ? nameParts[1] : string.Empty;
                string templateText = await File.ReadAllTextAsync(templateFilePath);

                result.GetOrAdd(entityTypeName, new ConcurrentDictionary<string, string>())[tabName] = templateText;
            }

            return result;
        }

        // Tries to load code for our meta tag from Storage
        private static async Task<string> GetCustomMetaTagCodeFromStorageAsync()
        {
            var blobClient = CloudStorageAccount.Parse(Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage)).CreateCloudBlobClient();
            var container = blobClient.GetContainerReference(Globals.TemplateContainerName);
            var blob = container.GetBlobReference(Globals.CustomMetaTagBlobName);

            if (!(await blob.ExistsAsync()))
            {
                return null;
            }

            using (var stream = new MemoryStream())
            {
                await blob.DownloadToStreamAsync(stream);
                return Encoding.UTF8.GetString(stream.ToArray());
            }
        }

        // Tries to load code for our meta tag from local folder
        private static async Task<string> GetCustomMetaTagCodeFromFolderAsync(string folderName)
        {
            string binFolder = Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location);
            string filePath = Path.Combine(binFolder, "..", folderName, Globals.CustomMetaTagBlobName);

            if(!File.Exists(filePath))
            {
                return null;
            }

            return await File.ReadAllTextAsync(filePath);
        }
    }

    // Represents the liquid template map
    class LiquidTemplatesMap: ConcurrentDictionary<string, IDictionary<string, string>>
    {
        public List<string> GetTemplateNames(string entityTypeName)
        {
            var result = new List<string>();
            IDictionary<string, string> templates;

            // Getting template names for all entity types
            if (this.TryGetValue(string.Empty, out templates))
            {
                result.AddRange(templates.Keys);
            }

            // Getting template names for this particular entity type
            if (this.TryGetValue(entityTypeName, out templates))
            {
                result.AddRange(templates.Keys);
            }

            result.Sort();

            return result;
        }

        public string GetTemplate(string entityTypeName, string templateName)
        {
            string result = null;
            IDictionary<string, string> templates;

            // Getting template names for all entity types
            if (this.TryGetValue(string.Empty, out templates))
            {
                if(templates.TryGetValue(templateName, out result)){
                    return result;
                }
            }

            // Getting template names for this particular entity type
            if (this.TryGetValue(entityTypeName, out templates))
            {
                if (templates.TryGetValue(templateName, out result))
                {
                    return result;
                }
            }

            return result;
        }
    }
}
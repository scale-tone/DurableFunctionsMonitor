using System;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Text.RegularExpressions;
using Microsoft.WindowsAzure.Storage.Table;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Microsoft.WindowsAzure.Storage;
using System.IO;
using System.Text;
using System.Collections.Concurrent;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public enum EntityTypeEnum
    {
        Orchestration = 0,
        DurableEntity
    }

    // Adds extra fields to original DurableOrchestrationStatus
    public class ExpandedOrchestrationStatus : DurableOrchestrationStatus
    {
        // Yes, it is OK to use Task in this way.
        // The Task code will only be executed once. All subsequent/parallel awaits will get the same returned value.
        // Tasks do have the same behavior as Lazy<T>.
        internal static readonly Task<LiquidTemplatesMap> TabTemplatesTask = GetTabTemplates();

        public static readonly Regex EntityIdRegex = new Regex(@"@(\w+)@(.+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        public EntityTypeEnum EntityType { get; private set; }
        public EntityId? EntityId { get; private set; }

        public string LastEvent
        {
            get
            {
                if(this._detailsTask == null)
                {
                    return string.Empty;
                }

                if (this._lastEvent != null)
                {
                    return this._lastEvent;
                }

                this._lastEvent = string.Empty;
                DurableOrchestrationStatus details;
                try
                {
                    // For some orchestrations getting an extended status might fail due to bugs in DurableOrchestrationClient.
                    // So just returning an empty string in that case.
                    details = this._detailsTask.Result;
                }
                catch(Exception)
                {
                    return this._lastEvent;
                }

                if (details.History == null)
                {
                    return this._lastEvent;
                }

                var lastEvent = details.History
                    .Select(e => e["Name"] ?? e["FunctionName"] )
                    .LastOrDefault(e => e != null);

                if (lastEvent == null)
                {
                    return this._lastEvent;
                }

                this._lastEvent = lastEvent.ToString();
                return this._lastEvent;
            }
        }

        public List<string> TabTemplateNames
        {
            get
            {
                // The underlying Task never throws, so it's OK.
                var templatesMap = TabTemplatesTask.Result;
                return templatesMap.GetTemplateNames(this.GetEntityTypeName());
            }
        }

        public ExpandedOrchestrationStatus(DurableOrchestrationStatus that,
            Task<DurableOrchestrationStatus> detailsTask,
            Task<IEnumerable<HistoryEntity>> subOrchestrationsTask,
            HashSet<string> hiddenColumns = null)
        {
            this.Name = that.Name;
            this.InstanceId = that.InstanceId;
            this.CreatedTime = that.CreatedTime;
            this.LastUpdatedTime = that.LastUpdatedTime;
            this.RuntimeStatus = that.RuntimeStatus;

            this.Input = (hiddenColumns != null && hiddenColumns.Contains("input")) ? null : that.Input;
            this.Output = (hiddenColumns != null && hiddenColumns.Contains("output")) ? null : that.Output;
            this.CustomStatus = (hiddenColumns != null && hiddenColumns.Contains("customStatus")) ? null : that.CustomStatus;

            this.History = subOrchestrationsTask == null ? that.History : this.TryMatchingSubOrchestrations(that.History, subOrchestrationsTask);

            // Detecting whether it is an Orchestration or a Durable Entity
            var match = EntityIdRegex.Match(this.InstanceId);
            if(match.Success)
            {
                this.EntityType = EntityTypeEnum.DurableEntity;
                this.EntityId = new EntityId(match.Groups[1].Value, match.Groups[2].Value);
            }

            this._detailsTask = detailsTask;
        }

        internal string GetEntityTypeName()
        {
            return this.EntityType == EntityTypeEnum.DurableEntity ? this.EntityId.Value.EntityName : this.Name;
        }

        private Task<DurableOrchestrationStatus> _detailsTask;
        private string _lastEvent;

        private static readonly string[] SubOrchestrationEventTypes = new[] 
        {
            "SubOrchestrationInstanceCompleted",
            "SubOrchestrationInstanceFailed",
        };

        private JArray TryMatchingSubOrchestrations(JArray history, Task<IEnumerable<HistoryEntity>> subOrchestrationsTask)
        {
            if(history == null)
            {
                return null;
            }

            var subOrchestrationEvents = history
                .Where(h => SubOrchestrationEventTypes.Contains(h.Value<string>("EventType")))
                .ToList();

            if(subOrchestrationEvents.Count <= 0)
            {
                return history;
            }

            try
            {
                foreach (var subOrchestration in subOrchestrationsTask.Result)
                {
                    // Trying to match by SubOrchestration name and start time
                    var matchingEvent = subOrchestrationEvents.FirstOrDefault(e =>
                        e.Value<string>("FunctionName") == subOrchestration.Name &&
                        e.Value<DateTime>("ScheduledTime") == subOrchestration._Timestamp
                    );

                    if (matchingEvent == null)
                    {
                        continue;
                    }

                    // Modifying the event object
                    matchingEvent["SubOrchestrationId"] = subOrchestration.InstanceId;

                    // Dropping this line, so that multiple suborchestrations are correlated correctly
                    subOrchestrationEvents.Remove(matchingEvent);
                }
            } 
            catch(Exception ex)
            {
                // Intentionally swallowing any exceptions here
            }

            return history;
        }

        private const string TabTemplateContainerName = "durable-functions-monitor";
        private const string TabTemplateFolderName = "tab-templates/";

        // Tries to load liquid templates from underlying Azure Storage
        private static async Task<LiquidTemplatesMap> GetTabTemplates()
        {
            var result = new LiquidTemplatesMap();
            try
            {
                string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                var blobClient = CloudStorageAccount.Parse(connectionString).CreateCloudBlobClient();

                // Listing all blobs in durable-functions-monitor/tab-templates folder
                var container = blobClient.GetContainerReference(TabTemplateContainerName);
                var templateNames = await container.ListBlobsAsync(TabTemplateFolderName);

                // Loading blobs in parallel
                await Task.WhenAll(templateNames.Select(async templateName =>
                {
                    var blob = await blobClient.GetBlobReferenceFromServerAsync(templateName.Uri);

                    // Expecting the blob name to be like "[Tab Name].[EntityTypeName].liquid" or just "[Tab Name].liquid"
                    var nameParts = blob.Name.Substring(TabTemplateFolderName.Length).Split('.');
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
            catch (Exception ex)
            {
                // Intentionally swallowing all exceptions here
            }
            return result;
        }
    }

    // Represents an record in XXXHistory table
    public class HistoryEntity : TableEntity
    {
        public string InstanceId { get; set; }
        public string Name { get; set; }
        public DateTimeOffset _Timestamp { get; set; }
    }

    // Represents the liquid template map
    public class LiquidTemplatesMap: ConcurrentDictionary<string, IDictionary<string, string>>
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
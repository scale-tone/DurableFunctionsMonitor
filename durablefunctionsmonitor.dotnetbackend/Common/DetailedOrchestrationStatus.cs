using System;
using System.Threading.Tasks;
using System.Linq;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.WindowsAzure.Storage.Table;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;
using Microsoft.WindowsAzure.Storage;
using System.IO;
using System.Text;
using System.Collections.Concurrent;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Adds extra fields to DurableOrchestrationStatus returned by IDurableClient.GetStatusAsync()
    class DetailedOrchestrationStatus : DurableOrchestrationStatus
    {
        public EntityTypeEnum EntityType { get; private set; }
        public EntityId? EntityId { get; private set; }

        public List<string> TabTemplateNames
        {
            get
            {
                // The underlying Task never throws, so it's OK.
                var templatesMap = CustomTemplates.GetTabTemplatesAsync().Result;
                return templatesMap.GetTemplateNames(this.GetEntityTypeName());
            }
        }

        public DetailedOrchestrationStatus(DurableOrchestrationStatus that, Task<IEnumerable<HistoryEntity>> subOrchestrationsTask)
        {
            this.Name = that.Name;
            this.InstanceId = that.InstanceId;
            this.CreatedTime = that.CreatedTime;
            this.LastUpdatedTime = that.LastUpdatedTime;
            this.RuntimeStatus = that.RuntimeStatus;
            this.Output = that.Output;
            this.CustomStatus = that.CustomStatus;

            this.History = this.TryMatchingSubOrchestrations(that.History, subOrchestrationsTask);
            this.History = this.ConvertScheduledTime(this.History);

            // Detecting whether it is an Orchestration or a Durable Entity
            var match = ExpandedOrchestrationStatus.EntityIdRegex.Match(this.InstanceId);
            if(match.Success)
            {
                this.EntityType = EntityTypeEnum.DurableEntity;
                this.EntityId = new EntityId(match.Groups[1].Value, match.Groups[2].Value);
            }

            this.Input = this.ConvertInput(that.Input);
        }

        internal string GetEntityTypeName()
        {
            return this.EntityType == EntityTypeEnum.DurableEntity ? this.EntityId.Value.EntityName : this.Name;
        }

        private static readonly string[] SubOrchestrationEventTypes = new[] 
        {
            "SubOrchestrationInstanceCompleted",
            "SubOrchestrationInstanceFailed",
        };

        private JArray ConvertScheduledTime(JArray history)
        {
            if (history == null)
            {
                return null;
            }

            var orchestrationStartedEvent = history.FirstOrDefault(h => h.Value<string>("EventType") == "ExecutionStarted");

            foreach (var e in history)
            {
                if(e["ScheduledTime"] != null)
                {
                    // Converting to UTC and explicitly formatting as a string (otherwise default serializer outputs it as a local time)
                    var scheduledTime = e.Value<DateTime>("ScheduledTime").ToUniversalTime();
                    e["ScheduledTime"] = scheduledTime.ToString("o");

                    // Also adding DurationInMs field
                    var timestamp = e.Value<DateTime>("Timestamp").ToUniversalTime();
                    var duration = timestamp - scheduledTime;
                    e["DurationInMs"] = duration.TotalMilliseconds;
                }

                // Also adding duration of the whole orchestration
                if(e.Value<string>("EventType") == "ExecutionCompleted" && orchestrationStartedEvent != null)
                {
                    var scheduledTime = orchestrationStartedEvent.Value<DateTime>("Timestamp").ToUniversalTime();
                    var timestamp = e.Value<DateTime>("Timestamp").ToUniversalTime();
                    var duration = timestamp - scheduledTime;
                    e["DurationInMs"] = duration.TotalMilliseconds;
                }
            }

            return history;
        }

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
            catch(Exception)
            {
                // Intentionally swallowing any exceptions here
            }

            return history;
        }

        private JToken ConvertInput(JToken input)
        {
            if (this.EntityType != EntityTypeEnum.DurableEntity)
            {
                return input;
            }

            var stateToken = input["state"];
            if (stateToken == null || stateToken.Type != JTokenType.String)
            {
                return input;
            }

            var stateString = stateToken.Value<string>();
            if (!(stateString.StartsWith('{') && stateString.EndsWith('}')))
            {
                return input;
            }

            // Converting JSON string into JSON object
            input["state"] = JObject.Parse(stateString);
            return input;
        }
    }

    // Represents an record in XXXHistory table
    class HistoryEntity : TableEntity
    {
        public string InstanceId { get; set; }
        public string Name { get; set; }
        public DateTimeOffset _Timestamp { get; set; }
    }
}
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

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

        public DetailedOrchestrationStatus(DurableOrchestrationStatus that)
        {
            this.Name = that.Name;
            this.InstanceId = that.InstanceId;
            this.CreatedTime = that.CreatedTime;
            this.LastUpdatedTime = that.LastUpdatedTime;
            this.RuntimeStatus = that.RuntimeStatus;
            this.Output = that.Output;
            this.CustomStatus = that.CustomStatus;
            this.History = that.History;

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
}
using System;
using System.Threading.Tasks;
using Microsoft.Azure.WebJobs;
using System.Linq;

namespace DurableFunctionsMonitor.DotNetBackend
{
    // Adds extra fields to original DurableOrchestrationStatus
    public class ExpandedOrchestrationStatus : DurableOrchestrationStatus
    {
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
        public ExpandedOrchestrationStatus(DurableOrchestrationStatus that, Task<DurableOrchestrationStatus> detailsTask)
        {
            this.Name = that.Name;
            this.InstanceId = that.InstanceId;
            this.CreatedTime = that.CreatedTime;
            this.LastUpdatedTime = that.LastUpdatedTime;
            this.Input = that.Input;
            this.Output = that.Output;
            this.RuntimeStatus = that.RuntimeStatus;
            this.CustomStatus = that.CustomStatus;

            this._detailsTask = detailsTask;
        }
        private Task<DurableOrchestrationStatus> _detailsTask;
        private string _lastEvent;
    }
}
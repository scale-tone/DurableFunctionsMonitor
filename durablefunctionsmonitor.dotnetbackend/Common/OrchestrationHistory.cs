using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using Microsoft.WindowsAzure.Storage.Table;

namespace DurableFunctionsMonitor.DotNetBackend
{
    static class OrchestrationHistory
    {
        /// <summary>
        /// Fetches orchestration instance history directly from XXXHistory table
        /// Tries to mimic this algorithm: https://github.com/Azure/azure-functions-durable-extension/blob/main/src/WebJobs.Extensions.DurableTask/ContextImplementations/DurableClient.cs#L718
        /// Intentionally returns IEnumerable<>, because the consuming code not always iterates through all of it.
        /// </summary>
        public static IEnumerable<HistoryEvent> GetHistoryDirectlyFromTable(IDurableClient durableClient, string connName, string hubName, string instanceId)
        {
            // Need to fetch executionId first
            var instanceTable = TableClient.GetTableClient(connName).GetTableReference($"{hubName}Instances");
            var executionIdQuery = new TableQuery<InstanceEntity>().Where(TableQuery.GenerateFilterCondition("PartitionKey", QueryComparisons.Equal, instanceId));
            string executionId = instanceTable.ExecuteQuerySegmentedAsync(executionIdQuery, null).Result.Results[0].ExecutionId;

            var instanceIdFilter = TableQuery.CombineFilters
            (
                TableQuery.GenerateFilterCondition("PartitionKey", QueryComparisons.Equal, instanceId),
                TableOperators.And,
                TableQuery.GenerateFilterCondition("ExecutionId", QueryComparisons.Equal, executionId)
            );

            // Fetching _all_ correlated events with a separate parallel query. This seems to be the only option.
            var correlatedEventsQuery = new TableQuery<HistoryEntity>().Where
            (
                TableQuery.CombineFilters
                (
                    instanceIdFilter,
                    TableOperators.And,
                    TableQuery.GenerateFilterConditionForInt("TaskScheduledId", QueryComparisons.GreaterThanOrEqual, 0)
                )
            );

            var historyTable = TableClient.GetTableClient(connName).GetTableReference($"{hubName}History");
            var correlatedEventsTask = historyTable.GetAllAsync(correlatedEventsQuery)
                .ContinueWith(t => t.Result.ToDictionary(e => e.TaskScheduledId));

            // Fetching the history
            var query = new TableQuery<HistoryEntity>().Where(instanceIdFilter);

            // Memorizing 'ExecutionStarted' event, to further correlate with 'ExecutionCompleted'
            HistoryEntity executionStartedEvent = null;

            TableContinuationToken token = null;
            do
            {
                var nextBatch = historyTable.ExecuteQuerySegmentedAsync(query, token).Result;

                foreach (var evt in nextBatch.Results)
                {
                    switch (evt.EventType)
                    {
                        case "TaskScheduled":
                        case "SubOrchestrationInstanceCreated":

                            // Trying to match the completion event
                            correlatedEventsTask.Result.TryGetValue(evt.EventId, out var correlatedEvt);
                            if (correlatedEvt != null)
                            {
                                yield return correlatedEvt.ToHistoryEvent
                                (
                                    evt._Timestamp, 
                                    evt.Name, 
                                    correlatedEvt.EventType == "GenericEvent" ? evt.EventType : null, 
                                    evt.InstanceId
                                );
                            }
                            else
                            {
                                yield return evt.ToHistoryEvent();
                            }

                            break;
                        case "ExecutionStarted":

                            executionStartedEvent = evt;

                            yield return evt.ToHistoryEvent(null, evt.Name);

                            break;
                        case "ExecutionCompleted":
                        case "ExecutionFailed":
                        case "ExecutionTerminated":

                            yield return evt.ToHistoryEvent(executionStartedEvent?._Timestamp);

                            break;
                        case "ContinueAsNew":
                        case "TimerCreated":
                        case "TimerFired":
                        case "EventRaised":
                        case "EventSent":

                            yield return evt.ToHistoryEvent();

                            break;
                    }
                }

                token = nextBatch.ContinuationToken;
            }
            while (token != null);
        }

        private static HistoryEvent ToHistoryEvent(this HistoryEntity evt, 
            DateTimeOffset? scheduledTime = null, 
            string functionName = null, 
            string eventType = null,
            string subOrchestrationId = null)
        {
            return new HistoryEvent
            {
                Timestamp = evt._Timestamp.ToUniversalTime(),
                EventType = eventType ?? evt.EventType,
                EventId = evt.TaskScheduledId,
                Name = evt.Name,
                Result = evt.Result,
                Details = evt.Details,
                SubOrchestrationId = subOrchestrationId,
                ScheduledTime = scheduledTime,
                FunctionName = functionName,
                DurationInMs = scheduledTime.HasValue ? (evt._Timestamp - scheduledTime.Value).TotalMilliseconds : 0
            };
        }
    }

    /// <summary>
    /// Represents a record in orchestration's history
    /// </summary>
    public class HistoryEvent
    {
        public DateTimeOffset Timestamp { get; set; }
        public string EventType { get; set; }
        public int? EventId { get; set; }
        public string Name { get; set; }
        public string FunctionName { get; set; }
        public DateTimeOffset? ScheduledTime { get; set; }
        public string Result { get; set; }
        public string Details { get; set; }
        public double? DurationInMs { get; set; }
        public string SubOrchestrationId { get; set; }
    }

    // Represents an record in XXXInstances table
    class InstanceEntity : TableEntity
    {
        public string ExecutionId { get; set; }
    }

    // Represents an record in XXXHistory table
    class HistoryEntity : TableEntity
    {
        public string InstanceId { get; set; }
        public string EventType { get; set; }
        public string Name { get; set; }
        public DateTimeOffset _Timestamp { get; set; }
        public string Result { get; set; }
        public string Details { get; set; }
        public int EventId { get; set; }
        public int? TaskScheduledId { get; set; }
    }
}

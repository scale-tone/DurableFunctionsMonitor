using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Linq.Expressions;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.Threading;
using Microsoft.Azure.WebJobs.Extensions.DurableTask.ContextImplementations;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class StaticOrchestrations
    {
        public class Orchestrations: HttpHandlerBase
        {
            public Orchestrations(IDurableClientFactory durableClientFactory): base(durableClientFactory) {}

            // Adds sorting, paging and filtering capabilities around /runtime/webhooks/durabletask/instances endpoint.
            // GET /a/p/i{connAndTaskHub}/orchestrations?$filter=<filter>&$orderby=<order-by>&$skip=<m>&$top=<n>
            [FunctionName(nameof(DfmGetOrchestrationsFunction))]
            public Task<IActionResult> DfmGetOrchestrationsFunction(
                [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = Globals.ApiRoutePrefix + "/orchestrations")] HttpRequest req,
                [DurableClient(TaskHub = Globals.TaskHubRouteParamName)] IDurableClient defaultDurableClient,
                string connAndTaskHub,
                ILogger log)
            {
                return this.HandleAuthAndErrors(defaultDurableClient, req, connAndTaskHub, log, async (durableClient) => {

                    DateTime? timeFrom, timeTill;
                    string filterString = ExtractTimeRange(req.Query["$filter"], out timeFrom, out timeTill);

                    string[] statuses;
                    filterString = ExtractRuntimeStatuses(filterString, out statuses);
                    var filterClause = new FilterClause(filterString);

                    string hiddenColumnsString = req.Query["hidden-columns"];
                    var hiddenColumns = string.IsNullOrEmpty(hiddenColumnsString) ? new HashSet<string>() : new HashSet<string>(hiddenColumnsString.Split('|'));

                    // Filtered column should always be returned
                    if(!string.IsNullOrEmpty(filterClause.FieldName))
                    {
                        hiddenColumns.Remove(filterClause.FieldName);
                    }

                    var orchestrations = durableClient
                        .ListAllInstances(timeFrom, timeTill, !hiddenColumns.Contains("input"), statuses)
                        .ExpandStatusIfNeeded(durableClient, filterClause, hiddenColumns)
                        .ApplyRuntimeStatusesFilter(statuses)
                        .ApplyFilter(filterClause)
                        .ApplyOrderBy(req.Query)
                        .ApplySkip(req.Query)
                        .ApplyTop(req.Query);

                    return orchestrations.ToJsonContentResult(Globals.FixUndefinedsInJson);
                });
            }
        }

        // Adds 'lastEvent' field to each entity, but only if being filtered by that field
        private static IEnumerable<ExpandedOrchestrationStatus> ExpandStatusIfNeeded(this IEnumerable<DurableOrchestrationStatus> orchestrations, 
            IDurableClient client, FilterClause filterClause, HashSet<string> hiddenColumns)
        {
            // Only expanding if being filtered by lastEvent
            if(filterClause.FieldName == "lastEvent") 
            {
                return orchestrations.ExpandStatus(client, filterClause, hiddenColumns);
            } 
            else
            {
                return orchestrations.Select(o => new ExpandedOrchestrationStatus(o, null, hiddenColumns));
            }
        }

        // Adds 'lastEvent' field to each entity
        private static IEnumerable<ExpandedOrchestrationStatus> ExpandStatus(this IEnumerable<DurableOrchestrationStatus> orchestrations,
            IDurableClient client, FilterClause filterClause, HashSet<string> hiddenColumns)
        {
            // Deliberately explicitly enumerating orchestrations here, to trigger all GetStatusAsync tasks in parallel.
            // If just using yield return, they would be started and finished sequentially, one by one.
            var list = new List<ExpandedOrchestrationStatus>();
            foreach (var orchestration in orchestrations)
            {
                list.Add(new ExpandedOrchestrationStatus(orchestration,
                    client.GetStatusAsync(orchestration.InstanceId, true, false, false),
                    hiddenColumns));
            }
            return list;
        }

        // Takes constraints for createdTime field out of $filter clause and returns the remains of it
        private static string ExtractTimeRange(string filterClause, out DateTime? timeFrom, out DateTime? timeTill){

            timeFrom = null;
            timeTill = null;

            if(string.IsNullOrEmpty(filterClause))
            {
                return filterClause;
            }

            var match = TimeFromRegex.Match(filterClause);
            if(match.Success) 
            {
                timeFrom = DateTime.Parse(match.Groups[2].Value);
                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            match = TimeTillRegex.Match(filterClause);
            if (match.Success)
            {
                timeTill = DateTime.Parse(match.Groups[2].Value);
                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            return filterClause;
        }

        // Takes list of runtimeStatuses out of $filter clause and returns the remains of it
        private static string ExtractRuntimeStatuses(string filterClause, out string[] runtimeStatuses)
        {
            runtimeStatuses = null;

            if (string.IsNullOrEmpty(filterClause))
            {
                return filterClause;
            }

            var match = RuntimeStatusRegex.Match(filterClause);
            if (match.Success)
            {
                runtimeStatuses = match.Groups[2].Value
                    .Split(',').Where(s => !string.IsNullOrEmpty(s))
                    .Select(s => s.Trim(' ', '\'')).ToArray();

                filterClause = filterClause.Substring(0, match.Index) + filterClause.Substring(match.Index + match.Length);
            }

            return filterClause;
        }

        private static IEnumerable<ExpandedOrchestrationStatus> ApplyFilter(this IEnumerable<ExpandedOrchestrationStatus> orchestrations,
            FilterClause filter)
        {
            if(string.IsNullOrEmpty(filter.FieldName))
            {
                foreach (var orchestration in orchestrations)
                {
                    yield return orchestration;
                }
            }
            else
            {
                if (filter.Predicate == null)
                {
                    // if filter expression is invalid, returning nothing
                    yield break;
                }

                var propInfo = typeof(ExpandedOrchestrationStatus)
                    .GetProperties()
                    .FirstOrDefault(p => p.Name.Equals(filter.FieldName, StringComparison.InvariantCultureIgnoreCase));

                if (propInfo == null)
                {
                    // if field name is invalid, returning nothing
                    yield break;
                }

                foreach (var orchestration in orchestrations)
                {
                    if (filter.Predicate(orchestration.GetPropertyValueAsString(propInfo)))
                    {
                        yield return orchestration;
                    }
                }
            }
        }

        private static IEnumerable<ExpandedOrchestrationStatus> ApplyRuntimeStatusesFilter(this IEnumerable<ExpandedOrchestrationStatus> orchestrations,
            string[] statuses)
        {
            if (statuses == null)
            {
                return orchestrations;
            }

            bool includeDurableEntities = statuses.Contains(DurableEntityRuntimeStatus, StringComparer.OrdinalIgnoreCase);
            var runtimeStatuses = statuses.ToRuntimeStatuses().ToArray();

            return orchestrations.Where(o => {

                if (o.EntityType == EntityTypeEnum.DurableEntity)
                {
                    return includeDurableEntities;
                }
                else 
                {
                    return runtimeStatuses.Contains(o.RuntimeStatus);
                }
            });
        }

        private static IEnumerable<ExpandedOrchestrationStatus> ApplyOrderBy(this IEnumerable<ExpandedOrchestrationStatus> orchestrations,
            IQueryCollection query)
        {
            var clause = query["$orderby"];
            if (!clause.Any())
            {
                return orchestrations;
            }

            var orderByParts = clause.ToString().Split(' ');
            bool desc = string.Equals("desc", orderByParts.Skip(1).FirstOrDefault(), StringComparison.OrdinalIgnoreCase);

            return orchestrations.OrderBy(orderByParts[0], desc);
        }

        // OrderBy that takes property name as a string (instead of an expression)
        private static IEnumerable<T> OrderBy<T>(this IEnumerable<T> sequence, string fieldName, bool desc)
        {
            var paramExpression = Expression.Parameter(typeof(T));
            Expression fieldAccessExpression;
            
            try
            {
                fieldAccessExpression = Expression.PropertyOrField(paramExpression, fieldName);
            }
            catch (Exception)
            {
                // If field is invalid, returning original enumerable
                return sequence;
            }

            var genericParamType = fieldAccessExpression.Type;

            if (!genericParamType.IsPrimitive && genericParamType != typeof(DateTime) && genericParamType != typeof(DateTimeOffset))
            {
                // If this is a complex object field, then sorting by it's string representation
                fieldAccessExpression = Expression.Call(fieldAccessExpression, ToStringMethodInfo);
                genericParamType = typeof(string);
            }

            var methodInfo = (desc ? OrderByDescMethodInfo : OrderByMethodInfo)
                .MakeGenericMethod(typeof(T), genericParamType);

            return (IEnumerable<T>)methodInfo.Invoke(null, new object[] {
                sequence,
                Expression.Lambda(fieldAccessExpression, paramExpression).Compile()
            });
        }

        // Helper for formatting orchestration field values
        private static string GetPropertyValueAsString(this ExpandedOrchestrationStatus orchestration, PropertyInfo propInfo)
        {
            object propValue = propInfo.GetValue(orchestration);

            // Explicitly handling DateTime as 'yyyy-MM-ddTHH:mm:ssZ'
            return propInfo.PropertyType == typeof(DateTime) ?
                ((DateTime)propValue).ToString(Globals.SerializerSettings.DateFormatString) :
                propValue.ToString();
        }

        // Some reasonable page size for ListInstancesAsync
        private const int ListInstancesPageSize = 500;

        // Intentionally NOT using async/await here, because we need yield return.
        // The magic is to only load all the pages, when it is really needed (e.g. when sorting is used).
        private static IEnumerable<DurableOrchestrationStatus> ListAllInstances(this IDurableClient durableClient, DateTime? timeFrom, DateTime? timeTill, bool showInput, string[] statuses)
        {
            var queryCondition = new OrchestrationStatusQueryCondition()
            {
                PageSize = ListInstancesPageSize,
                ShowInput = showInput
            };

            if (timeFrom.HasValue)
            {
                queryCondition.CreatedTimeFrom = timeFrom.Value;
            }
            if (timeTill.HasValue)
            {
                queryCondition.CreatedTimeTo = timeTill.Value;
            }

            if (statuses != null)
            {
                var runtimeStatuses = statuses.ToRuntimeStatuses().ToList();

                // Durable Entities are always 'Running'
                if (statuses.Contains(DurableEntityRuntimeStatus, StringComparer.OrdinalIgnoreCase))
                {
                    runtimeStatuses.Add(OrchestrationRuntimeStatus.Running);
                }

                queryCondition.RuntimeStatus = runtimeStatuses;
            }

            OrchestrationStatusQueryResult response = null;
            do
            {
                queryCondition.ContinuationToken = response == null ? null : response.ContinuationToken;

                response = durableClient.ListInstancesAsync(queryCondition, CancellationToken.None).Result;
                foreach (var item in response.DurableOrchestrationState)
                {
                    yield return item;
                }
            }
            while (!string.IsNullOrEmpty(response.ContinuationToken));
        }

        private static IEnumerable<OrchestrationRuntimeStatus> ToRuntimeStatuses(this string[] statuses)
        {
            foreach(var s in statuses)
            {
                if (Enum.TryParse<OrchestrationRuntimeStatus>(s, true, out var runtimeStatus))
                {
                    yield return runtimeStatus;
                }
            }
        }

        private const string DurableEntityRuntimeStatus = "DurableEntities";

        private static readonly Regex RuntimeStatusRegex = new Regex(@"\s*(and\s*)?runtimeStatus in \(([^\)]*)\)(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeFromRegex = new Regex(@"\s*(and\s*)?createdTime ge '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeTillRegex = new Regex(@"\s*(and\s*)?createdTime le '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static MethodInfo OrderByMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderBy" && m.GetParameters().Length == 2);
        private static MethodInfo OrderByDescMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderByDescending" && m.GetParameters().Length == 2);
        private static MethodInfo ToStringMethodInfo = ((Func<string>)new object().ToString).Method;
    }
}

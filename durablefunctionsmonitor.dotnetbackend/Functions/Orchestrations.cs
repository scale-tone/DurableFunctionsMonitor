using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Reflection;
using System.Linq.Expressions;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Orchestrations
    {
        // Adds sorting, paging and filtering capabilities around /runtime/webhooks/durabletask/instances endpoint.
        // GET /api/orchestrations?$filter=<filter>&$orderby=<order-by>&$skip=<m>&$top=<n>
        [FunctionName("orchestrations")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)] HttpRequest req,
            [DurableClient] IDurableClient durableClient,
            ILogger log)
        {
            // Checking that the call is authenticated properly
            try
            {
                Globals.ValidateIdentity(req.HttpContext.User, req.Headers);
            }
            catch(UnauthorizedAccessException ex)
            {
                return new OkObjectResult(ex.Message) { StatusCode = 401 };
            }

            DateTime? timeFrom, timeTill;
            string filterString = ExtractTimeRange(req.Query["$filter"], out timeFrom, out timeTill);
            var filterClause = new FilterClause(filterString);

            var orchestrations = (await (
                (timeFrom.HasValue && timeTill.HasValue) ? 
                durableClient.GetStatusAsync(timeFrom.Value, timeTill, new OrchestrationRuntimeStatus[0]) : 
                durableClient.GetStatusAsync()
            ))
            .ExpandStatusIfNeeded(durableClient, filterClause)
            .ApplyFilter(filterClause)
            .ApplyOrderBy(req.Query)
            .ApplySkip(req.Query)
            .ApplyTop(req.Query);

            string json = JsonConvert.SerializeObject(orchestrations, Globals.SerializerSettings)
                .FixUndefinedsInJson();
            return new ContentResult() { Content = json, ContentType = "application/json" };
        }

        // Adds 'lastEvent' field to each entity, but only if being filtered by that field
        private static IEnumerable<ExpandedOrchestrationStatus> ExpandStatusIfNeeded(this IEnumerable<DurableOrchestrationStatus> orchestrations, 
            IDurableClient client, FilterClause filterClause)
        {
            // Only expanding if being filtered by lastEvent
            bool needToExpand = filterClause.FieldName == "lastEvent";

            // Deliberately explicitly enumerating orchestrations here, to trigger all GetStatusAsync tasks in parallel.
            // If just using yield return, they would be started and finished sequentially, one by one.
            var list = new List<ExpandedOrchestrationStatus>();
            foreach(var orchestration in orchestrations)
            {
                list.Add(new ExpandedOrchestrationStatus(orchestration,
                    needToExpand ? client.GetStatusAsync(orchestration.InstanceId, true, false, false) : null));
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

        private static IEnumerable<ExpandedOrchestrationStatus> ApplyOrderBy(this IEnumerable<ExpandedOrchestrationStatus> orchestrations,
            IQueryCollection query)
        {
            var clause = query["$orderby"];
            if(!clause.Any())
            {
                return orchestrations;
            }

            var orderByParts = clause.ToString().Split(' ');
            bool desc = string.Equals("desc", orderByParts.Skip(1).FirstOrDefault(), StringComparison.OrdinalIgnoreCase);

            return orchestrations.OrderBy(orderByParts[0], desc);
        }

        private static IEnumerable<ExpandedOrchestrationStatus> ApplyTop(this IEnumerable<ExpandedOrchestrationStatus> orchestrations,
            IQueryCollection query)
        {
            var clause = query["$top"];
            return clause.Any() ? orchestrations.Take(int.Parse(clause)) : orchestrations;
        }
        private static IEnumerable<ExpandedOrchestrationStatus> ApplySkip(this IEnumerable<ExpandedOrchestrationStatus> orchestrations, 
            IQueryCollection query)
        {
            var clause = query["$skip"];
            return clause.Any() ? orchestrations.Skip(int.Parse(clause)) : orchestrations;
        }

        // OrderBy that takes property name as a string (instead of an expression)
        private static IEnumerable<T> OrderBy<T>(this IEnumerable<T> sequence, string fieldName, bool desc)
        {
            var paramExpression = Expression.Parameter(typeof(T));
            Expression fieldAccessExpression = Expression.PropertyOrField(paramExpression, fieldName);
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

        private static readonly Regex TimeFromRegex = new Regex(@"\s*(and\s*)?createdTime ge '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeTillRegex = new Regex(@"\s*(and\s*)?createdTime le '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static MethodInfo OrderByMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderBy" && m.GetParameters().Length == 2);
        private static MethodInfo OrderByDescMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderByDescending" && m.GetParameters().Length == 2);
        private static MethodInfo ToStringMethodInfo = ((Func<string>)new object().ToString).Method;
    }
}

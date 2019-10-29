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

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Orchestrations
    {
        // Adds sorting, paging and filtering capabilities around /runtime/webhooks/durabletask/instances endpoint.
        // GET /api/orchestrations?$filter=<filter>&$orderby=<order-by>&$skip=<m>&$top=<n>
        [FunctionName("orchestrations")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = null)] HttpRequest req,
            [OrchestrationClient] DurableOrchestrationClient orchestrationClient,
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
            string filter = ExtractTimeRange(req.Query["$filter"], out timeFrom, out timeTill);

            var orchestrations = (await (
                (timeFrom.HasValue && timeTill.HasValue) ? 
                orchestrationClient.GetStatusAsync(timeFrom.Value, timeTill, new OrchestrationRuntimeStatus[0]) : 
                orchestrationClient.GetStatusAsync()
            ))
            .ApplyFilter(filter)
            .ApplyOrderBy(req.Query)
            .ApplySkip(req.Query)
            .ApplyTop(req.Query);

            string json = JsonConvert.SerializeObject(orchestrations, Globals.SerializerSettings)
                .FixUndefinedsInJson();
            return new ContentResult() { Content = json, ContentType = "application/json" };
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

        private static IEnumerable<DurableOrchestrationStatus> ApplyFilter(this IEnumerable<DurableOrchestrationStatus> orchestrations,
            string filterClause)
        {
            if (string.IsNullOrWhiteSpace(filterClause))
            {
                foreach (var orchestration in orchestrations) yield return orchestration;
            }
            else
            {
                Func<string, bool> predicate = null;

                var match = StartsWithRegex.Match(filterClause);
                if(match.Success)
                {
                    // startswith(field-name, 'value')
                    predicate = (v) => v.StartsWith(match.Groups[2].Value);
                }
                else
                {
                    match = ContainsRegex.Match(filterClause);
                    if (match.Success)
                    {
                        // contains(field-name, 'value')
                        predicate = (v) => v.Contains(match.Groups[2].Value);
                    }
                    else 
                    {
                        match = EqRegex.Match(filterClause);
                        if (match.Success)
                        {
                            // field-name eq 'value'
                            string value = match.Groups[2].Value;
                            predicate = (v) => {
                                return value == "null" ? string.IsNullOrEmpty(v) : v == value;
                            };
                        }
                    }
                }

                if(predicate == null)
                {
                    // if filter expression is invalid, returning nothing
                    yield break;
                }

                string fieldName = match.Groups[1].Value;
                var propInfo = typeof(DurableOrchestrationStatus)
                    .GetProperties()
                    .FirstOrDefault(p => p.Name.Equals(fieldName, StringComparison.InvariantCultureIgnoreCase));

                if (propInfo == null)
                {
                    // if field name is invalid, returning nothing
                    yield break;
                }

                foreach (var orchestration in orchestrations)
                {
                    if(predicate(orchestration.GetPropertyValueAsString(propInfo)))
                    {
                        yield return orchestration;
                    }
                }
            }
        }

        private static IEnumerable<DurableOrchestrationStatus> ApplyOrderBy(this IEnumerable<DurableOrchestrationStatus> orchestrations,
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

        private static IEnumerable<DurableOrchestrationStatus> ApplyTop(this IEnumerable<DurableOrchestrationStatus> orchestrations,
            IQueryCollection query)
        {
            var clause = query["$top"];
            return clause.Any() ? orchestrations.Take(int.Parse(clause)) : orchestrations;
        }
        private static IEnumerable<DurableOrchestrationStatus> ApplySkip(this IEnumerable<DurableOrchestrationStatus> orchestrations, 
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
        private static string GetPropertyValueAsString(this DurableOrchestrationStatus orchestration, PropertyInfo propInfo)
        {
            object propValue = propInfo.GetValue(orchestration);

            // Explicitly handling DateTime as 'yyyy-MM-ddTHH:mm:ssZ'
            return propInfo.PropertyType == typeof(DateTime) ?
                ((DateTime)propValue).ToString(Globals.SerializerSettings.DateFormatString) :
                propValue.ToString();
        }

        private static readonly Regex StartsWithRegex = new Regex(@"startswith\((\w+),\s*'([^']+)'\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex ContainsRegex = new Regex(@"contains\((\w+),\s*'([^']+)'\)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex EqRegex = new Regex(@"(\w+)\s*eq\s*'([^']+)", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeFromRegex = new Regex(@"\s*(and\s*)?createdTime ge '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static readonly Regex TimeTillRegex = new Regex(@"\s*(and\s*)?createdTime le '([\d-:.T]{19,}Z)'(\s*and)?\s*", RegexOptions.IgnoreCase | RegexOptions.Compiled);
        private static MethodInfo OrderByMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderBy" && m.GetParameters().Length == 2);
        private static MethodInfo OrderByDescMethodInfo = typeof(Enumerable).GetMethods().First(m => m.Name == "OrderByDescending" && m.GetParameters().Length == 2);
        private static MethodInfo ToStringMethodInfo = ((Func<string>)new object().ToString).Method;
    }
}

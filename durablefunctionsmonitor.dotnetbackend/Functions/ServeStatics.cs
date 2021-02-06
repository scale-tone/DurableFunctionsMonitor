using System.IO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Linq;
using System.Threading.Tasks;
using System;
using Newtonsoft.Json.Linq;
using Microsoft.Extensions.Logging;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class ServeStatics
    {
        private const string StaticsRoute = "{p1?}/{p2?}/{p3?}";

        // A simple statics hosting solution
        [FunctionName(nameof(DfmServeStaticsFunction))]
        public static async Task<IActionResult> DfmServeStaticsFunction(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = StaticsRoute)] HttpRequest req,
            ExecutionContext context,
            ILogger log
        )
        {
            string root = context.FunctionAppDirectory + "/DfmStatics";
            string path = req.Path.Value;

            string routePrefix = GetRoutePrefixFromHostJson(context, log);
            string dfmRoutePrefix = GetDfmRoutePrefixFromFunctionJson(context, log);
            if(!string.IsNullOrEmpty(dfmRoutePrefix))
            {
                routePrefix = string.IsNullOrEmpty(routePrefix) ? dfmRoutePrefix : routePrefix + "/" + dfmRoutePrefix;
            }

            // Applying routePrefix, if it is set to something other than empty string
            if (!string.IsNullOrEmpty(routePrefix) && path.StartsWith("/" + routePrefix))
            {
                path = path.Substring(routePrefix.Length + 1);
            }

            var contentType = FileMap.FirstOrDefault((kv => path.StartsWith(kv[0])));
            if (contentType != null)
            {
                return File.Exists(root + path) ?
                    (IActionResult)new FileStreamResult(File.OpenRead(root + path), contentType[1]) :
                    new NotFoundResult();
            }

            // Returning index.html by default, to support client routing
            string html = await File.ReadAllTextAsync($"{root}/index.html");

            // Applying routePrefix, if it is set to something other than empty string
            if (!string.IsNullOrEmpty(routePrefix))
            {
                html = html.Replace("<script>var DfmRoutePrefix=\"\"</script>", $"<script>var DfmRoutePrefix=\"{routePrefix}\"</script>");
                html = html.Replace("href=\"/", $"href=\"/{routePrefix}/");
                html = html.Replace("src=\"/", $"src=\"/{routePrefix}/");
            }

            return new ContentResult()
            {
                Content = html,
                ContentType = "text/html; charset=UTF-8"
            };
        }

        private static readonly string[][] FileMap = new string[][]
        {
            new [] {"/static/css/", "text/css; charset=utf-8"},
            new [] {"/static/js/", "application/javascript; charset=UTF-8"},
            new [] {"/manifest.json", "application/json; charset=UTF-8"},
            new [] {"/favicon.png", "image/png"},
            new [] {"/logo.svg", "image/svg+xml; charset=UTF-8"},
        };

        private static string RoutePrefix = null;
        // Gets routePrefix setting from host.json (since there seems to be no other place to take it from)
        private static string GetRoutePrefixFromHostJson(ExecutionContext context, ILogger log)
        {
            if (RoutePrefix != null)
            {
                return RoutePrefix;
            }

            try
            {
                string hostJsonFileName = Path.Combine(context.FunctionAppDirectory, "host.json");
                dynamic hostJson = JObject.Parse(File.ReadAllText(hostJsonFileName));

                RoutePrefix = hostJson.extensions.http.routePrefix;
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to get RoutePrefix from host.json, using default value ('api')");
                RoutePrefix = "api";
            }
            return RoutePrefix;
        }

        private static string DfmRoutePrefix = null;
        // Gets DfmRoutePrefix from our function.json file, but only if that file wasn't modified by our build task.
        private static string GetDfmRoutePrefixFromFunctionJson(ExecutionContext context, ILogger log)
        {
            if (DfmRoutePrefix != null)
            {
                return DfmRoutePrefix;
            }

            DfmRoutePrefix = string.Empty;
            try
            {
                string functionJsonFileName = Path.Combine(context.FunctionAppDirectory, nameof(DfmServeStaticsFunction), "function.json");
                dynamic functionJson = JObject.Parse(File.ReadAllText(functionJsonFileName));

                string route = functionJson.bindings[0].route;

                // if it wasn't modified by our build task, then doing nothing
                if(route != StaticsRoute)
                {
                    DfmRoutePrefix = route.Substring(0, route.IndexOf('/'));
                }
            }
            catch (Exception ex)
            {
                log.LogError(ex, "Failed to get DfmRoutePrefix from function.json, using default value (empty string)");
            }
            return DfmRoutePrefix;
        }
    }
}

using System.IO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using System.Linq;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Monitor
    {
        // A simple statics hosting solution
        [FunctionName("monitor")]
        public static IActionResult Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "{p1?}/{p2?}/{p3?}")] HttpRequest req,
            ExecutionContext context
        )
        {
            string root = context.FunctionAppDirectory + "/wwwroot";
            string path = req.Path.Value;//.Substring("/api/monitor".Length);

            var contentType = FileMap.FirstOrDefault((kv => path.StartsWith(kv[0])));
            if (contentType != null)
            {
                return File.Exists(root + path) ?
                    (IActionResult)new FileStreamResult(File.OpenRead(root + path), contentType[1]) :
                    new NotFoundResult();
            }
            // Returning index.html by default, to support client routing
            return new FileStreamResult(File.OpenRead($"{root}/index.html"), "text/html; charset=UTF-8");
        }

        private static readonly string[][] FileMap = new string[][]
        {
            new [] {"/static/css/", "text/css; charset=utf-8"},
            new [] {"/static/media/", "image/svg+xml; charset=UTF-8"},
            new [] {"/static/js/", "application/javascript; charset=UTF-8"},
            new [] {"/manifest.json", "application/json; charset=UTF-8"},
            new [] {"/service-worker.js", "application/javascript; charset=UTF-8"},
            new [] {"/favicon.png", "image/png"}
        };
    }
}

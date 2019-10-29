# DurableFunctionsMonitor.DotNetBackend

Backend for DurableFunctionsMonitor, reimplemented in C#.
C#-based backend is more suitable for using with VsCode extension, because we can suppress it's /runtime/webhooks/durabletask endpoint via proxies.json. That endpoint is exposed by the framework, doesn't have any auth (when running locally) and returns quite sensitive data, so it's better to keep it suppressed. While the TypeScript-based backend wouldn't work without it, because it actually communicates with it.
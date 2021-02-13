using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.Extensions.Logging;
using DurableFunctionsMonitor.DotNetBackend;
using System.Threading.Tasks;
using Moq;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System;
using System.Linq;
using System.Reflection;
using Microsoft.Azure.WebJobs;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;

namespace durablefunctionsmonitor.dotnetbackend.tests
{
    [TestClass]
    public class AuthTests
    {
        [TestInitialize]
        public void TestInit()
        {
            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_NONCE, string.Empty);
        }

        [TestMethod]
        public async Task ReturnsUnauthorizedResultIfNotAuthenticated()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var durableClientMoq = new Mock<IDurableClient>();
            var logMoq = new Mock<ILogger>();

            // Getting the list of all functions to be validated
            var functionsToBeCalled = typeof(DfmEndpoint).Assembly.DefinedTypes
                .Where(t => t.IsClass)
                .SelectMany(t => t.GetMethods(BindingFlags.Static | BindingFlags.Public))
                .Where(m => m.CustomAttributes.Any(a => a.AttributeType == typeof(FunctionNameAttribute)))
                .Select(m => m.Name)
                .ToHashSet();

            // Only these two methods should be publicly accessible as of today
            functionsToBeCalled.Remove(nameof(ServeStatics.DfmServeStaticsFunction));
            functionsToBeCalled.Remove(nameof(EasyAuthConfig.DfmGetEasyAuthConfigFunction));

            // Collecting the list of functions that were actually called by this test
            var functionsThatWereCalled = new HashSet<string>();
            var methodExtractionRegex = new Regex(@"\.(\w+)\(HttpRequest req,");

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));
                    Assert.AreEqual("No access token provided. Call is rejected.", ex.Message);

                    // Also extracting the function name that was called
                    functionsThatWereCalled.Add(methodExtractionRegex.Match(ex.StackTrace).Groups[1].Value);
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, string.Empty);

            // Act
            var results = new List<IActionResult>()
            {
                await About.DfmAboutFunction(request, "TestHub", logMoq.Object),

                await CleanEntityStorage.DfmCleanEntityStorageFunction(request, durableClientMoq.Object, logMoq.Object),

                await DeleteTaskHub.DfmDeleteTaskHubFunction(request, "TestHub", logMoq.Object),

                await IdSuggestions.DfmGetIdSuggestionsFunction(request, durableClientMoq.Object, "abc", logMoq.Object),

                await ManageConnection.DfmManageConnectionFunction(request, "TestHub", new Microsoft.Azure.WebJobs.ExecutionContext(), logMoq.Object),

                await IdSuggestions.DfmGetIdSuggestionsFunction(request, durableClientMoq.Object, "abc", logMoq.Object),

                await Orchestration.DfmGetOrchestrationFunction(request, "abc", durableClientMoq.Object, logMoq.Object),

                await Orchestration.DfmPostOrchestrationFunction(request, "abc", "todo", durableClientMoq.Object, logMoq.Object),

                await Orchestration.DfmGetOrchestrationTabMarkupFunction(request, "abc", "todo", durableClientMoq.Object, logMoq.Object),

                await Orchestrations.DfmGetOrchestrationsFunction(request, durableClientMoq.Object, logMoq.Object),

                await PurgeHistory.DfmPurgeHistoryFunction(request, durableClientMoq.Object, logMoq.Object),

                await TaskHubNames.DfmGetTaskHubNamesFunction(request, logMoq.Object),
            };

            // Assert
            results.ForEach(r => Assert.IsInstanceOfType(r, typeof(UnauthorizedResult)));

            functionsToBeCalled.ExceptWith(functionsThatWereCalled);
            Assert.IsTrue(functionsToBeCalled.Count == 0, "You forgot to test " + string.Join(", ", functionsToBeCalled));
        }

        [TestMethod]
        public async Task ReturnsUnauthorizedResultIfTaskHubNotAllowed()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var logMoq = new Mock<ILogger>();

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, "Hub1,Hub2,Hub3");

            // Act
            var result = await About.DfmAboutFunction(request, "InvalidHubName", logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(UnauthorizedResult));
        }
    }
}

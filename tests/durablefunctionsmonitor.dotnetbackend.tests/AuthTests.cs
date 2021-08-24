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
using System.Security.Claims;
using Microsoft.Azure.WebJobs.Extensions.DurableTask;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Threading;
using System.Diagnostics;

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

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));
                    Assert.AreEqual("No access token provided. Call is rejected.", ex.Message);

                    // Also extracting the function name, that was called, from current stack trace
                    foreach(var stackFrame in new StackTrace().GetFrames())
                    {
                        var method = stackFrame.GetMethod();
                        if (method.CustomAttributes.Any(a => a.AttributeType == typeof(FunctionNameAttribute)) )
                        {
                            functionsThatWereCalled.Add(method.Name);
                        }
                    }
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

                await Orchestration.DfmGetOrchestrationHistoryFunction(request, "TestHub", "abc", durableClientMoq.Object, logMoq.Object),

                await Orchestration.DfmStartNewOrchestrationFunction(request, durableClientMoq.Object, logMoq.Object),

                await Orchestration.DfmPostOrchestrationFunction(request, "abc", "todo", durableClientMoq.Object, logMoq.Object),

                await Orchestration.DfmGetOrchestrationTabMarkupFunction(request, "abc", "todo", durableClientMoq.Object, logMoq.Object),

                await Orchestrations.DfmGetOrchestrationsFunction(request, durableClientMoq.Object, logMoq.Object),

                await PurgeHistory.DfmPurgeHistoryFunction(request, durableClientMoq.Object, logMoq.Object),

                await TaskHubNames.DfmGetTaskHubNamesFunction(request, logMoq.Object),

                await FunctionMap.DfmGetFunctionMap(request, "TestHub", logMoq.Object),
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
                    Assert.AreEqual("Task Hub 'InvalidHubName' is not allowed.", ex.Message);
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, "Hub1,Hub2,Hub3");

            // Act
            var result = await About.DfmAboutFunction(request, "InvalidHubName", logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(UnauthorizedResult));
        }

        [TestMethod]
        public async Task ReturnsUnauthorizedResultIfUserNotWhitelisted()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var logMoq = new Mock<ILogger>();

            string userName = "tino@contoso.com";

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));
                    Assert.AreEqual($"User {userName} is not mentioned in {EnvVariableNames.DFM_ALLOWED_USER_NAMES} config setting. Call is rejected", ex.Message);
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, string.Empty);
            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES, "user1@contoso.com,user2@contoso.com");

            // Need to reset DfmEndpoint.Settings
            DfmEndpoint.Setup();

            request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity[] { new ClaimsIdentity( new Claim[] {
                new Claim("preferred_username", userName)})
            });

            // Act
            var result = await About.DfmAboutFunction(request, "TestHub", logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(UnauthorizedResult));
        }


        [TestMethod]
        public async Task ReturnsUnauthorizedResultIfUserIsNotInRole()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var logMoq = new Mock<ILogger>();

            string userName = "tino@contoso.com";

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));
                    Assert.AreEqual($"User {userName} doesn't have any of roles mentioned in {EnvVariableNames.DFM_ALLOWED_APP_ROLES} config setting. Call is rejected", ex.Message);
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, string.Empty);
            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES, "");
            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_APP_ROLES, "role1,role2");

            // Need to reset DfmEndpoint.Settings
            DfmEndpoint.Setup();

            request.HttpContext.User = new ClaimsPrincipal(new ClaimsIdentity[] { new ClaimsIdentity( new Claim[] {
                new Claim("preferred_username", userName)})
            });

            // Act
            var result = await About.DfmAboutFunction(request, "TestHub", logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(UnauthorizedResult));
        }

        // The only way to define a callback for ValidateToken() method
        delegate void ValidateTokenDelegate(string a, TokenValidationParameters p, out SecurityToken t);

        [TestMethod]
        public async Task ValidatesTokenWithoutEasyAuthsHelp()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var logMoq = new Mock<ILogger>();

            string userName = "tino@contoso.com";
            string roleName = "my-app-role";
            string audience = "my-audience";
            string issuer = "my-issuer";
            string token = "blah-blah";

            var principal = new ClaimsPrincipal(new ClaimsIdentity[] { new ClaimsIdentity( new Claim[] {
                new Claim("preferred_username", userName),
                new Claim("roles", roleName)
            })});

            ICollection<SecurityKey> securityKeys = new SecurityKey[0];

            ValidateTokenDelegate validateTokenDelegate = (string t, TokenValidationParameters p, out SecurityToken st) =>
            {
                st = null;

                Assert.AreEqual(token, t);
                Assert.AreEqual(audience, p.ValidAudiences.Single());
                Assert.AreEqual(issuer, p.ValidIssuers.Single());
                Assert.AreEqual(securityKeys, p.IssuerSigningKeys);
            };

            SecurityToken st = null;
            var jwtHandlerMoq = new Mock<JwtSecurityTokenHandler>();
            jwtHandlerMoq.Setup(h => h.ValidateToken(It.IsAny<string>(), It.IsAny<TokenValidationParameters>(), out st))
                .Callback(validateTokenDelegate)
                .Returns(principal);

            Auth.MockedJwtSecurityTokenHandler = jwtHandlerMoq.Object;
            Auth.GetSigningKeysTask = Task.FromResult(securityKeys);

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, string.Empty);
            Environment.SetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_CLIENT_ID, audience);
            Environment.SetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER, issuer);

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES, "user1@contoso.com,user2@contoso.com," + userName);
            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_APP_ROLES, roleName);
            Environment.SetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage, token);

            // Need to reset DfmEndpoint.Settings
            DfmEndpoint.Setup();

            request.Headers.Add("Authorization", "Bearer " + token);

            // Act
            var result = await About.DfmAboutFunction(request, "TestHub", logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(ContentResult));
        }

        [TestMethod]
        public async Task LoadsListOfTablesFromTableStorage()
        {
            // Arrange
            var request = new DefaultHttpContext().Request;

            var logMoq = new Mock<ILogger>();

            bool tableClientInitialized = false;
            string hubName = "InvalidHubName";

            logMoq.Setup(log => log.Log(It.IsAny<LogLevel>(), It.IsAny<EventId>(), It.IsAny<It.IsAnyType>(), It.IsAny<Exception>(), It.IsAny<Func<It.IsAnyType, Exception, string>>()))
                .Callback((LogLevel l, EventId i, object s, Exception ex, object o) =>
                {
                    // Ensuring the correct type of exception was raised internally
                    Assert.IsInstanceOfType(ex, typeof(UnauthorizedAccessException));

                    // If TableClient throws, task hub validation should be skipped, and we should get 'No access token provided'.
                    // Next time, when MockedTableClient is set, we should get 'Task Hub is not allowed'.
                    // This also validates that queries against table storage are properly retried.
                    Assert.AreEqual(
                        tableClientInitialized ? 
                        $"Task Hub '{hubName}' is not allowed." :
                        "No access token provided. Call is rejected.", 
                        ex.Message);
                });

            Environment.SetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME, string.Empty);

            var tableClientMoq = new Mock<ITableClient>();

            tableClientMoq.Setup(c => c.ListTableNamesAsync())
                .Returns(Task.FromResult<IEnumerable<string>>(new string[] { 
                    "Hub1Instances","Hub1History",
                    "Hub2Instances","Hub2History" 
                }));

            // Act
            var result = await About.DfmAboutFunction(request, hubName, logMoq.Object);

            TableClient.MockedTableClient = tableClientMoq.Object;
            tableClientInitialized = true;

            result = await About.DfmAboutFunction(request, hubName, logMoq.Object);
            result = await About.DfmAboutFunction(request, hubName, logMoq.Object);

            // Assert
            Assert.IsInstanceOfType(result, typeof(UnauthorizedResult));
        }

        [TestMethod]
        public void RetriesGettingSigningKeys()
        {
            // Arrange
            var initialFailedTask = Task.FromException<ICollection<SecurityKey>>(new Exception("Something failed"));
            Auth.GetSigningKeysTask = initialFailedTask;

            // Act
            var resultTask = Auth.InitGetSigningKeysTask(1, 1);
            Thread.Sleep(100);

            // Assert
            Assert.AreNotEqual(initialFailedTask, resultTask);
            Assert.AreNotEqual(initialFailedTask, Auth.GetSigningKeysTask);
        }

        [TestMethod]
        public void RetriesGettingSigningKeysNoMoreThan2Times()
        {
            // Arrange
            var initialFailedTask = Task.FromException<ICollection<SecurityKey>>(new Exception("Something failed"));
            Auth.GetSigningKeysTask = initialFailedTask;

            // Act
            var resultTask = Auth.InitGetSigningKeysTask(1, 2);
            Thread.Sleep(100);

            // Assert
            Assert.AreNotEqual(initialFailedTask, resultTask);
            Assert.AreEqual(initialFailedTask, Auth.GetSigningKeysTask);
        }

        [TestMethod]
        public void CachesSigningKeysAndAutomaticallyRefreshesTheCache()
        {
            // Arrange

            // Just using a shared metadata endpoint, to make the first task succeed
            Environment.SetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER, "https://login.microsoftonline.com/common");

            // Initializing the key retrieval task so, that it resets itself in 1 second
            var initialTask = Auth.InitGetSigningKeysTask(1);
            Auth.GetSigningKeysTask = initialTask;

            // Resetting the issuer to an invalid value, to make second task fail
            Environment.SetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER, "invalid-issuer");

            // Act
            Thread.Sleep(2000);
            var finalTask = Auth.GetSigningKeysTask;

            // Assert
            Assert.AreNotEqual(initialTask, finalTask);
            Assert.IsTrue(initialTask.IsCompletedSuccessfully);
            Assert.IsTrue(finalTask.IsFaulted);
        }
    }
}

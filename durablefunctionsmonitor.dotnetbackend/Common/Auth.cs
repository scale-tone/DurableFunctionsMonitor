using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using Microsoft.WindowsAzure.Storage;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Auth
    {
        // Magic constant for turning auth off
        private const string ISureKnowWhatIAmDoingNonce = "i_sure_know_what_i_am_doing";

        // User name claim name
        private const string PreferredUserNameClaim = "preferred_username";

        // Validates that the incoming request is properly authenticated
        public static async Task ValidateIdentityAsync(ClaimsPrincipal principal, IHeaderDictionary headers, string taskHubName)
        {
            // First validating Task Hub name
            if (!string.IsNullOrEmpty(taskHubName) && !(await IsTaskHubNameValid(taskHubName)))
            {
                throw new UnauthorizedAccessException($"Task Hub '{taskHubName}' is not allowed.");
            }

            // Starting with nonce (used when running as a VsCode extension)
            string nonce = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_NONCE);
            if(!string.IsNullOrEmpty(nonce))
            {
                // From now on it is the only way to skip auth
                if (nonce == ISureKnowWhatIAmDoingNonce)
                {
                    return;
                }

                // Checking the nonce header
                if (nonce == headers["x-dfm-nonce"])
                {
                    return;
                }

                throw new UnauthorizedAccessException("Invalid nonce. Call is rejected.");
            }

            // Trying with EasyAuth first
            var userNameClaim = principal?.FindFirst(PreferredUserNameClaim);
            if(userNameClaim == null)
            {
                // Validating and parsing the token ourselves
                principal = await ValidateToken(headers["Authorization"]);
                userNameClaim = principal.FindFirst(PreferredUserNameClaim);
            }

            if(userNameClaim == null)
            {
                throw new UnauthorizedAccessException($"'{PreferredUserNameClaim}' claim is missing in the incoming identity. Call is rejected.");
            }

            string allowedUserNames = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES);
            if(!string.IsNullOrEmpty(allowedUserNames))
            {
                if(!allowedUserNames.Split(',').Contains(userNameClaim.Value))
                {
                    throw new UnauthorizedAccessException($"User {userNameClaim.Value} is not mentioned in {EnvVariableNames.DFM_ALLOWED_USER_NAMES} config setting. Call is rejected");
                }
            }
        }

        // Lists all allowed Task Hubs. The returned HashSet is configured to ignore case.
        public static async Task<HashSet<string>> GetAllowedTaskHubNamesAsync()
        {
            // Respecting DFM_HUB_NAME, if it is set
            string dfmHubNames = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_HUB_NAME);
            if (!string.IsNullOrEmpty(dfmHubNames))
            {
                return new HashSet<string>(dfmHubNames.Split(','), StringComparer.InvariantCultureIgnoreCase);
            }

            // Otherwise trying to load table names from the Storage
            try
            {
                string connectionString = Environment.GetEnvironmentVariable(EnvVariableNames.AzureWebJobsStorage);
                var tableClient = CloudStorageAccount.Parse(connectionString).CreateCloudTableClient();

                var tableNames = await tableClient.ListTableNamesAsync();

                var hubNames = new HashSet<string>(tableNames
                    .Where(n => n.EndsWith("Instances"))
                    .Select(n => n.Remove(n.Length - "Instances".Length)),
                    StringComparer.InvariantCultureIgnoreCase);

                hubNames.IntersectWith(tableNames
                    .Where(n => n.EndsWith("History"))
                    .Select(n => n.Remove(n.Length - "History".Length)));

                return hubNames;
            }
            catch (Exception)
            {
                // Intentionally returning null. Need to skip validation, if for some reason list of tables
                // cannot be loaded from Storage. But only in that case.
                return null;
            }
        }

        private static Task<HashSet<string>> HubNamesTask = GetAllowedTaskHubNamesAsync();

        // Checks that a Task Hub name is valid for this instace
        public static async Task<bool> IsTaskHubNameValid(string hubName)
        {
            var hubNames = await HubNamesTask;

            if (hubNames == null || !hubNames.Contains(hubName))
            {
                // doing double-check, by reloading hub names
                HubNamesTask = GetAllowedTaskHubNamesAsync();
                hubNames = await HubNamesTask;
            }

            // If existing Task Hub names cannot be read from Storage, we can only skip validation and return true.
            // Note, that if it will never be null, if DFM_HUB_NAME is set. So authZ is always in place.
            if (hubNames == null)
            {
                return true;
            }

            return hubNames.Contains(hubName);
        }

        private static async Task<ClaimsPrincipal> ValidateToken(string authorizationHeader)
        {
            if(string.IsNullOrEmpty(authorizationHeader))
            {
                throw new UnauthorizedAccessException("No access token provided. Call is rejected.");
            }

            string clientId = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_CLIENT_ID);
            if (string.IsNullOrEmpty(clientId))
            {
                throw new UnauthorizedAccessException($"Specify the Valid Audience value via '{EnvVariableNames.WEBSITE_AUTH_CLIENT_ID}' config setting. Typically it is the ClientId of your AAD application.");
            }

            string openIdIssuer = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER);
            if (string.IsNullOrEmpty(openIdIssuer))
            {
                throw new UnauthorizedAccessException($"Specify the Valid Issuer value via '{EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER}' config setting. Typically it looks like 'https://login.microsoftonline.com/<your-aad-tenant-id>/v2.0'.");
            }

            string token = authorizationHeader.Substring("Bearer ".Length);

            var validationParameters = new TokenValidationParameters
            {
                ValidAudiences = new[] { clientId },
                ValidIssuers = new[] { openIdIssuer },
                // Yes, it is OK to await a Task multiple times like this
                IssuerSigningKeys = await GetSigningKeysTask,
                // According to internet, this should not be needed (despite the fact that the default value is false)
                // But better to be two-bugs away
                ValidateIssuerSigningKey = true
            };

            return (new JwtSecurityTokenHandler()).ValidateToken(token, validationParameters, out SecurityToken validatedToken);
        }

        // Caching the keys for 24 hours
        private static Task<ICollection<SecurityKey>> GetSigningKeysTask = InitGetSigningKeysTask(86400, 0);

        private static Task<ICollection<SecurityKey>> InitGetSigningKeysTask(int cacheTtlInSeconds, int retryCount = 0)
        {
            // If you ever use this code in Asp.Net, don't forget to wrap this line with Task.Run(), to decouple from SynchronizationContext
            var task = GetSigningKeysAsync();

            // Adding cache-flushing continuation
            task.ContinueWith(async t =>
            {
                // If the data retrieval failed, then retrying immediately, but no more than 3 times.
                // Otherwise re-populating the cache in cacheTtlInSeconds.
                if(t.IsFaulted)
                {
                    if (retryCount > 1)
                    {
                        return;
                    }
                }
                else
                {
                    await Task.Delay(TimeSpan.FromSeconds(cacheTtlInSeconds));
                }

                GetSigningKeysTask = InitGetSigningKeysTask(cacheTtlInSeconds, t.IsFaulted ? retryCount + 1 : 0);
            });

            return task;
        }

        private static async Task<ICollection<SecurityKey>> GetSigningKeysAsync()
        {
            string openIdIssuer = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER);
            if (string.IsNullOrEmpty(openIdIssuer))
            {
                throw new UnauthorizedAccessException($"Specify the Valid Issuer value via '{EnvVariableNames.WEBSITE_AUTH_OPENID_ISSUER}' config setting. Typically it looks like 'https://login.microsoftonline.com/<your-aad-tenant-id>/v2.0'.");
            }

            if(openIdIssuer.EndsWith("/v2.0"))
            {
                openIdIssuer = openIdIssuer.Substring(0, openIdIssuer.Length - "/v2.0".Length);
            }

            string stsDiscoveryEndpoint = $"{openIdIssuer}/.well-known/openid-configuration";
            var configManager = new ConfigurationManager<OpenIdConnectConfiguration>(stsDiscoveryEndpoint, new OpenIdConnectConfigurationRetriever());
            var config = await configManager.GetConfigurationAsync();

            return config.SigningKeys;
        }
    }
}
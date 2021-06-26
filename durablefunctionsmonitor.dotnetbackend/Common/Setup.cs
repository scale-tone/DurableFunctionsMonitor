using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using Microsoft.WindowsAzure.Storage.Table;

namespace DurableFunctionsMonitor.DotNetBackend
{
    /// <summary>
    /// Defines functional mode for DurableFunctionsMonitor endpoint.
    /// </summary>
    public enum DfmMode
    {
        Normal = 0,
        ReadOnly
    }

    /// <summary>
    /// DurableFunctionsMonitor configuration settings
    /// </summary>
    public class DfmSettings
    {
        /// <summary>
        /// Turns authentication off for DurableFunctionsMonitor endpoint.
        /// WARNING: this might not only expose DurableFunctionsMonitor to the public, but also
        /// expose all other HTTP-triggered endpoints in your project. Make sure you know what you're doing.
        /// </summary>
        public bool DisableAuthentication { get; set; }

        /// <summary>
        /// Functional mode for DurableFunctionsMonitor endpoint.
        /// Currently only Normal (default) and ReadOnly modes are supported.
        /// </summary>
        public DfmMode Mode { get; set; }

        /// <summary>
        /// List of App Roles, that are allowed to access DurableFunctionsMonitor endpoint. Users/Groups then need 
        /// to be assigned one of these roles via AAD Enterprise Applications->[your AAD app]->Users and Groups tab.
        /// Once set, the incoming access token is expected to contain one of these in its 'roles' claim.
        /// </summary>
        public IEnumerable<string> AllowedAppRoles { get; set; }

        /// <summary>
        /// List of users, that are allowed to access DurableFunctionsMonitor endpoint. You typically put emails into here.
        /// Once set, the incoming access token is expected to contain one of these names in its 'preferred_username' claim.
        /// </summary>
        public IEnumerable<string> AllowedUserNames { get; set; }

        /// <summary>
        /// Folder where to search for custom tab/html templates.
        /// Must be a part of your Functions project and be adjacent to your host.json file.
        /// </summary>
        public string CustomTemplatesFolderName { get; set; }

        /// <summary>
        /// Name of the claim (from ClaimsCredential) to be used as a user name.
        /// Defaults to "preferred_username"
        /// </summary>
        public string UserNameClaimName { get; set; }

        public DfmSettings()
        {
            this.UserNameClaimName = Auth.PreferredUserNameClaim;
        }
    }

    /// <summary>
    /// A set of extension points that can be customized by the client code, when DFM is used in 'injected' mode.
    /// </summary>
    public class DfmExtensionPoints
    {
        /// <summary>
        /// Routine for fetching suborchestrations called by a given orchestration.
        /// Takes taskHubName and instanceId and returns IEnumerable[SubOrchestrationInfo].
        /// Default implementation fetches them from XXXHistory table.
        /// </summary>
        public Func<string, string, Task<IEnumerable<SubOrchestrationInfo>>> GetSubOrchestrationsRoutine { get; set; }

        public DfmExtensionPoints()
        {
            this.GetSubOrchestrationsRoutine = GetSubOrchestrationsAsync;
        }

        // Tries to get all SubOrchestration instanceIds for a given Orchestration from XXXHistory table
        private static async Task<IEnumerable<SubOrchestrationInfo>> GetSubOrchestrationsAsync(string taskHubName, string instanceId)
        {
            // Querying the table directly, as there is no other known way
            var table = TableClient.GetTableClient().GetTableReference($"{taskHubName}History");

            var query = new TableQuery<HistoryEntity>()
                .Where(TableQuery.CombineFilters(
                    TableQuery.GenerateFilterCondition("PartitionKey", QueryComparisons.Equal, instanceId),
                    TableOperators.And,
                    TableQuery.GenerateFilterCondition("EventType", QueryComparisons.Equal, "SubOrchestrationInstanceCreated")
                ));

            return (await table.GetAllAsync(query))
                .OrderBy(he => he._Timestamp)
                .Select(entity => new SubOrchestrationInfo { InstanceId = entity.InstanceId, FunctionName = entity.Name, Timestamp = entity._Timestamp });
        }
    }

    /// <summary>
    /// Container for passing info about a suborchestration
    /// </summary>
    public class SubOrchestrationInfo
    {
        public string InstanceId { get; set; }
        public string FunctionName { get; set; }
        public DateTimeOffset Timestamp { get; set; }
    }

    /// <summary>
    /// DurableFunctionsMonitor configuration
    /// </summary>
    public static class DfmEndpoint
    {
        /// <summary>
        /// Initializes DurableFunctionsMonitor endpoint with some settings
        /// </summary>
        /// <param name="settings">When null, default settings are used</param>
        /// <param name="extensionPoints">Routines, that can be customized by client code. When null, default instance of DfmExtensionPoints is used</param>
        public static void Setup(DfmSettings settings = null, DfmExtensionPoints extensionPoints = null)
        {
            string dfmNonce = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_NONCE);
            string dfmAllowedUserNames = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES);
            string dfmAllowedAppRoles = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_APP_ROLES);
            string dfmMode = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_MODE);
            string dfmUserNameClaimName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_USERNAME_CLAIM_NAME);

            _settings = settings ?? new DfmSettings()
            {
                // Don't want to move the below initializatin to DfmSettings's ctor. The idea is: either _everything_ comes 
                // from env variables or _everything_ is configured programmatically. To avoid unclarity we shouldn't mix these two approaches.
                DisableAuthentication = dfmNonce == Auth.ISureKnowWhatIAmDoingNonce,
                Mode = dfmMode == DfmMode.ReadOnly.ToString() ? DfmMode.ReadOnly : DfmMode.Normal,
                AllowedUserNames = dfmAllowedUserNames == null ? null : dfmAllowedUserNames.Split(','),
                AllowedAppRoles = dfmAllowedAppRoles == null ? null : dfmAllowedAppRoles.Split(','),
                UserNameClaimName = string.IsNullOrEmpty(dfmUserNameClaimName) ? Auth.PreferredUserNameClaim : dfmUserNameClaimName
            };

            if (extensionPoints != null)
            {
                _extensionPoints = extensionPoints;
            }
        }

        internal static DfmSettings Settings 
        {
            get 
            {
                if (_settings != null)
                {
                    return _settings;
                }

                if (!AreWeInStandaloneMode())
                {
                    throw new InvalidOperationException("Make sure you called DfmEndpoint.Setup() in your code");
                }

                DfmEndpoint.Setup();

                return _settings; 
            }
        }

        internal static DfmExtensionPoints ExtensionPoints 
        { 
            get { return _extensionPoints; } 
        }

        private static DfmSettings _settings = null;
        private static DfmExtensionPoints _extensionPoints = new DfmExtensionPoints();

        /// <summary>
        /// Checks whether we should do our internal initialization (Standalone mode)
        /// or throw an exception when not initialized (Injected mode)
        /// </summary>
        private static bool AreWeInStandaloneMode()
        {
            string assemblyLocation = Assembly.GetExecutingAssembly().Location;
            if(string.IsNullOrEmpty(assemblyLocation))
            {
                return true;
            }

            string currentFolder = Path.GetDirectoryName(assemblyLocation);
            string targetsFileName = "durablefunctionsmonitor.dotnetbackend.targets";

            // Using our .targets file as a marker. It should only appear in our own output folder
            return File.Exists(Path.Combine(currentFolder, targetsFileName)) || 
                File.Exists(Path.Combine(Path.GetDirectoryName(currentFolder), targetsFileName));
        }
    }
}
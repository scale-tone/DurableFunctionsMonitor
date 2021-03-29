using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;

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
    /// DurableFunctionsMonitor configuration
    /// </summary>
    public static class DfmEndpoint
    {
        /// <summary>
        /// Initializes DurableFunctionsMonitor endpoint with some settings
        /// </summary>
        /// <param name="settings">When null, default settings are used</param>
        public static void Setup(DfmSettings settings = null)
        {
            string dfmNonce = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_NONCE);
            string dfmAllowedUserNames = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_USER_NAMES);
            string dfmAllowedAppRoles = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_ALLOWED_APP_ROLES);
            string dfmMode = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_MODE);
            string dfmUserNameClaimName = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_USERNAME_CLAIM_NAME);

            _settings = settings ?? new DfmSettings()
            {
                DisableAuthentication = dfmNonce == Auth.ISureKnowWhatIAmDoingNonce,
                Mode = dfmMode == DfmMode.ReadOnly.ToString() ? DfmMode.ReadOnly : DfmMode.Normal,
                AllowedUserNames = dfmAllowedUserNames == null ? null : dfmAllowedUserNames.Split(','),
                AllowedAppRoles = dfmAllowedAppRoles == null ? null : dfmAllowedAppRoles.Split(','),
                UserNameClaimName = string.IsNullOrEmpty(dfmUserNameClaimName) ? Auth.PreferredUserNameClaim : dfmUserNameClaimName
            };
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

        private static DfmSettings _settings = null;

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
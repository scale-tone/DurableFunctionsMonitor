
using System;
using System.IO;
using System.Reflection;

namespace DurableFunctionsMonitor.DotNetBackend
{
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
            if (_settings != null)
            {
                return;
            }

            _settings = settings ?? new DfmSettings()
            {
                DisableAuthentication = Environment.GetEnvironmentVariable(EnvVariableNames.DFM_NONCE) == Auth.ISureKnowWhatIAmDoingNonce
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
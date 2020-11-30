
using System;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

namespace DurableFunctionsMonitor.DotNetBackend
{
    public static class Auth
    {
        // Validates that the incoming request is properly authenticated
        public static void ValidateIdentity(ClaimsPrincipal principal, IHeaderDictionary headers)
        {
            // Also validating nonce (used when running as a VsCode extension)
            string nonce = Environment.GetEnvironmentVariable("DFM_NONCE");
            if(!string.IsNullOrEmpty(nonce) && nonce != headers["x-dfm-nonce"])
            {
                throw new UnauthorizedAccessException("Invalid nonce. Call is rejected.");
            }

            string siteName = Environment.GetEnvironmentVariable(EnvVariableNames.WEBSITE_SITE_NAME);

            var userNameClaim = principal.FindFirst("preferred_username");
            if(userNameClaim == null)
            {
                if(string.IsNullOrEmpty(siteName))
                {
                    // Running on localhost, skipping identity validation
                    return;
                }

                throw new UnauthorizedAccessException("'preferred_username' claim is missing in the incoming identity. Call is rejected.");
            }

            if(string.IsNullOrEmpty(siteName))
            {
                throw new UnauthorizedAccessException("Looks like you are hosting the tool in Azure, but 'WEBSITE_SITE_NAME' environment variable is missing. Check your App Service configuration.");
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
    }
}

// Validates that the incoming request is properly authenticated
export function ValidateIdentity(identities: any[], log: (...args: any[]) => void) {

    // The list of claims is populated by EasyAuth module, if the incoming access token is successfully verified.
    var userName: string;
    if (!!identities && identities.length > 0) {
        const preferredUserNameClaim = identities[0].claims.find(c => c.type === 'preferred_username');
        if (!!preferredUserNameClaim) {
            userName = preferredUserNameClaim.value;
        }
    }

    if (!userName) {

        if (!process.env.WEBSITE_SITE_NAME) {

            log('NOTE: running on localhost, skipping identity validation');
            return;
        }

        throw '"preferred_username" claim is missing in the incoming identity. Call is rejected.';        
    }

    if (!process.env.WEBSITE_SITE_NAME) {
        
        throw 'Looks like you are hosting the tool in Azure, but "WEBSITE_SITE_NAME" environment variable is missing. Check your App Service configuration.';
    }

    // You can restrict the list of allowed users via this config setting
    const allowedUserNames = process.env.DFM_ALLOWED_USER_NAMES;
    if (!!allowedUserNames && !allowedUserNames.split(',').includes(userName)) {
        
        throw `User ${userName} is not mentioned in DFM_ALLOWED_USER_NAMES config setting. Call is rejected`;
    }
}
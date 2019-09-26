import { AzureFunction, Context, HttpRequest } from "@azure/functions"

// Returns EasyAuth configuration settings, specifically the AAD app's Client ID (which is not a secret)
// GET /api/easyauth-config
const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

    // When deployed to Azure, this tool should always be protected by EasyAuth
    if (!!process.env.WEBSITE_SITE_NAME && !process.env.WEBSITE_AUTH_CLIENT_ID) {
        
        context.res = {
            status: 401,
            body: `You need to configure EasyAuth for your '${process.env.WEBSITE_SITE_NAME}' instance. This tool should never be exposed to the world without authentication.`
        };

        return;
    }

    // Trying to get tenantId from WEBSITE_AUTH_OPENID_ISSUER environment variable
    const regex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/ig;
    const match = regex.exec(process.env.WEBSITE_AUTH_OPENID_ISSUER);
    const tenantId = (!!match) ? match[1] : 'common'; 
    
    context.res = {
        body: {
            clientId: process.env.WEBSITE_AUTH_CLIENT_ID,
            authority: `https://login.microsoftonline.com/${tenantId}`
        }
    };
};

export default httpTrigger;

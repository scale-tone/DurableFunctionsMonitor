import { AzureFunction, Context, HttpRequest } from "@azure/functions"
import * as DurableFunctions from "durable-functions"

// Handles orchestration instance operations.
// GET /api/orchestrations('<id>')
// POST /api/orchestrations('<id>')/rewind
// POST /api/orchestrations('<id>')/terminate
// POST /api/orchestrations('<id>')/raise-event
const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

    const orchestrationId = context.bindingData.id;
    const action = !!context.bindingData.action ? context.bindingData.action.toLowerCase() : '';
    
    const durableFunctionsClient = DurableFunctions.getClient(context);
    try {

        if (!action) {

            const status = await durableFunctionsClient.getStatus(orchestrationId, true, true, true);

            const errorResponse = status as any;
            // Surprisingly this also indicates an error
            if (!!errorResponse.Message) {
                
                context.res = {
                    body: errorResponse.Message,
                    status: 500
                };
                return;
            }

            context.res = {
                body: status
            };

            // Fighting with https://github.com/Azure/azure-functions-durable-js/issues/94
            if (typeof (context.res.body) === 'string') {
                var statusJson = context.res.body as string;
                statusJson = statusJson.replace(/:undefined/g, ':null');
                context.res.body = JSON.parse(statusJson);
            }

            return;
        }
        
        switch (action) {
            case 'rewind':
                await durableFunctionsClient.rewind(orchestrationId, req.body);
                return;
            case 'terminate':
                await durableFunctionsClient.terminate(orchestrationId, req.body);
                return;
            case 'raise-event':
                await durableFunctionsClient.raiseEvent(orchestrationId, req.body.name, req.body.data);
                return;
            default:
                context.res = { status: 404 };
        }

    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};

export default httpTrigger;

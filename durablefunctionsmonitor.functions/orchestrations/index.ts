import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import * as DurableFunctions from "durable-functions"

import * as lodash from "lodash";
import { DurableOrchestrationStatus } from "durable-functions/lib/src/classes";

import { ValidateIdentity } from "../ValidateIdentity";

// Adds sorting, paging and filtering capabilities around /runtime/webhooks/durabletask/instances endpoint.
// GET /api/orchestrations?$filter=<filter>&$orderby=<order-by>&$skip=<m>&$top=<n>
const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {

    // Checking that the call is authenticated properly
    try {
        ValidateIdentity(context.bindingData['$request'].http.identities, context.log);
    } catch (err) {
        context.res = { status: 401, body: err };
        return;
    }

    const durableFunctionsClient = DurableFunctions.getClient(context);

    const timeRange = { timeFrom: null, timeTill: null };
    var filterClause = req.query['$filter'];
    filterClause = extractTimeRange(filterClause, timeRange);

    var orchestrations = await ((!!timeRange.timeFrom && !!timeRange.timeTill)
        ? durableFunctionsClient.getStatusBy(timeRange.timeFrom, timeRange.timeTill, null)
        : durableFunctionsClient.getStatusAll());

    // Fighting with https://github.com/Azure/azure-functions-durable-js/issues/94
    if (typeof (orchestrations) === 'string') {
        var orchestrationsJson = orchestrations as string;
        orchestrationsJson = orchestrationsJson.replace(/:undefined/g, ':null');
        orchestrations = JSON.parse(orchestrationsJson);
    }

    const exceptionMessage = (orchestrations as any).ExceptionMessage; 
    if (!!exceptionMessage) {
        context.res = {
            status: 500,
            body: exceptionMessage
        };
        return;
    }

    orchestrations = applyFilter(orchestrations, filterClause);
    orchestrations = applyOrderBy(orchestrations, req.query);
    orchestrations = applySkip(orchestrations, req.query);
    orchestrations = applyTop(orchestrations, req.query);

    context.res = {
        body: orchestrations
    };
};

function applyOrderBy(orchestrations: DurableOrchestrationStatus[], query: {[key: string]: string;}) {

    const orderByClause = query['$orderby'];
    if (!orderByClause) {
        return orchestrations;
    }

    const orderByClauseParts = orderByClause.split(' ');

    return lodash.orderBy(orchestrations,
        [orderByClauseParts[0]],
        [orderByClauseParts[1] === 'desc' ? 'desc' : 'asc']);   
}

function applySkip(orchestrations: DurableOrchestrationStatus[], query: { [key: string]: string; }) {

    const skipClause = query['$skip'];
    if (!skipClause) {
        return orchestrations;
    }

    return lodash.drop(orchestrations, +skipClause);
}

function applyTop(orchestrations: DurableOrchestrationStatus[], query: { [key: string]: string; }) {

    const topClause = query['$top'];
    if (!topClause) {
        return orchestrations;
    }

    return lodash.take(orchestrations, +topClause);
}

function extractTimeRange(filterClause: string, timeRange: { timeFrom?: Date, timeTill?: Date }): string {

    if (!filterClause) {
        return filterClause;
    }

    var match = /\s*(and\s*)?createdTime ge '([\d-:.T]{19,}Z)'(\s*and)?\s*/i.exec(filterClause);
    if (!!match) {
        timeRange.timeFrom = new Date(match[2]);
        filterClause = filterClause.slice(0, match.index) + filterClause.slice(match.index + match[0].length);
    }

    var match = /\s*(and\s*)?createdTime le '([\d-:.T]{19,}Z)'(\s*and)?\s*/i.exec(filterClause);
    if (!!match) {
        timeRange.timeTill = new Date(match[2]);
        filterClause = filterClause.slice(0, match.index) + filterClause.slice(match.index + match[0].length);
    }

    return filterClause;
}

function applyFilter(orchestrations: DurableOrchestrationStatus[], filterClause: string): any {

    if (filterClause.startsWith('startswith')) {

        const regex = /startswith\((\w+),\s*'([^']+)'\)/g;
        const match = regex.exec(filterClause);
        if (!!match) {
            const fieldName = match[1];
            const fieldValue = match[2];

            return lodash.filter(orchestrations, (orchestration: DurableOrchestrationStatus) => {
                const field = orchestration[fieldName];

                if (!field) {
                    return false;
                }

                if (typeof (field) === 'string' ) {
                    return field.startsWith(fieldValue);
                } else {
                    return JSON.stringify(field).startsWith(fieldValue);
                }
            });
        }

        return [];
    }

    if (filterClause.startsWith('contains')) {

        const regex = /contains\((\w+),\s*'([^']+)'\)/g;
        const match = regex.exec(filterClause);
        if (!!match) {
            const fieldName = match[1];
            const fieldValue = match[2];

            return lodash.filter(orchestrations, (orchestration: DurableOrchestrationStatus) => {
                const field = orchestration[fieldName];

                if (!field) {
                    return false;
                }

                if (typeof (field) === 'string') {
                    return field.indexOf(fieldValue) !== -1;
                } else {
                    return JSON.stringify(field).indexOf(fieldValue) !== -1;
                }
            });
        }

        return [];
    }

    const regex = /(\w+)\s*eq\s*'([^']+)'/g;
    const match = regex.exec(filterClause);

    if (!!match) {
        const fieldName = match[1];
        const fieldValue = match[2];

        return lodash.filter(orchestrations, (orchestration: DurableOrchestrationStatus) => {

            if (fieldValue === 'null' && !orchestration[fieldName]) {
                return true;
            }

            return orchestration[fieldName] === fieldValue;
        });
    }
    
    return orchestrations;
}

export default httpTrigger;

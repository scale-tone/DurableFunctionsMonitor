
const space = '#32;';

function getTriggerBindingText(binding: any): string {

    switch (binding.type) {
        case 'httpTrigger':
            return `http${!binding.methods ? '' : ':[' + binding.methods.join(',') + ']'}${!binding.route ? '' : ':' + binding.route}`;
        case 'blobTrigger':
            return `blob:${binding.path ?? ''}`;
        case 'cosmosDBTrigger':
            return `cosmosDB:${binding.databaseName ?? ''}:${binding.collectionName ?? ''}`;
        case 'eventHubTrigger':
            return `eventHub:${binding.eventHubName ?? ''}`;
        case 'serviceBusTrigger':
            return `serviceBus:${!binding.queueName ? (binding.topicName ?? '') : binding.queueName}${!binding.subscriptionName ? '' : ':' + binding.subscriptionName}`;
        case 'queueTrigger':
            return `queue:${binding.queueName ?? ''}`;
        case 'timerTrigger':
            return `timer:${binding.schedule ?? ''}`;
        default:
            return binding.type;
    }
}

function getBindingText(binding: any): string {

    switch (binding.type) {
        case 'table':
            return `table:${binding.tableName ?? ''}`;
        case 'blob':
            return `blob:${binding.path ?? ''}`;
        case 'cosmosDB':
            return `cosmosDB:${binding.databaseName ?? ''}:${binding.collectionName ?? ''}`;
        case 'eventHub':
            return `eventHub:${binding.eventHubName ?? ''}`;
        case 'serviceBus':
            return `serviceBus:${!binding.queueName ? (binding.topicName ?? '') : binding.queueName}${!binding.subscriptionName ? '' : ':' + binding.subscriptionName}`;
        case 'queue':
            return `queue:${binding.queueName ?? ''}`;
        default:
            return binding.type;
    }
}

// Translates functions and their bindings into a Mermaid Flowchart diagram code
export function buildFunctionDiagramCode(funcs: {}): string {

    const functions = [];

    // Determine what kind of function this one is
    for (const name in funcs) {
        const func = funcs[name];

        var triggerBinding = undefined, inputBindings = [], outputBindings = [], otherBindings = [];
        var nodeCode = `${name}{{"${space}${name}"}}:::function`;

        for (const binding of func.bindings) {

            if (binding.type === 'orchestrationTrigger') {
                nodeCode = `${name}[["${space}${name}"]]:::orchestrator`;
            } else if (binding.type === 'activityTrigger') {
                nodeCode = `${name}[/"${space}${name}"/]:::activity`;
            } else if (binding.type === 'entityTrigger') {
                nodeCode = `${name}[("${space}${name}")]:::entity`;
            }

            if (binding.type.endsWith('Trigger')) {
                triggerBinding = binding;
            } else if (binding.direction === 'in') {
                inputBindings.push(binding);
            } else if (binding.direction === 'out') {
                outputBindings.push(binding);
            } else {
                otherBindings.push(binding);
            }
        }

        functions.push({ name, nodeCode, triggerBinding, inputBindings, outputBindings, otherBindings, ...func });
    }

    // Sorting by trigger type, then by name
    functions.sort((f1, f2) => {

        var s1 = (!!f1.isCalledBy?.length || !f1.triggerBinding || !f1.triggerBinding.type) ? '' : f1.triggerBinding.type;
        s1 += '~' + f1.name;

        var s2 = (!!f2.isCalledBy?.length || !f2.triggerBinding || !f2.triggerBinding.type) ? '' : f2.triggerBinding.type;
        s2 += '~' + f2.name;

        return (s1 > s2) ? 1 : ((s2 > s1) ? -1 : 0);
    });

    // Rendering
    var code = '';
    for (const func of functions) {

        code += `${func.nodeCode}\n`;

        if (!!func.isCalledBy?.length) {

            for (const calledBy of func.isCalledBy) {
                code += `${calledBy} --> ${func.name}\n`;
            }

        } else if (!!func.triggerBinding) {

            code += `${func.name}.${func.triggerBinding.type}>"${space}${getTriggerBindingText(func.triggerBinding)}"]:::${func.triggerBinding.type} --> ${func.name}\n`;
        }

        for (const inputBinding of func.inputBindings) {
            code += `${func.name}.${inputBinding.type}(["${space}${getBindingText(inputBinding)}"]):::${inputBinding.type} -.-> ${func.name}\n`;
        }

        for (const outputBinding of func.outputBindings) {
            code += `${func.name} -.-> ${func.name}.${outputBinding.type}(["${space}${getBindingText(outputBinding)}"]):::${outputBinding.type}\n`;
        }

        for (const otherBinding of func.otherBindings) {
            code += `${func.name} -.- ${func.name}.${otherBinding.type}(["${space}${getBindingText(otherBinding)}"]):::${otherBinding.type}\n`;
        }

        if (!!func.isSignalledBy?.length) {

            for (const signalledBy of func.isSignalledBy) {
                code += `${signalledBy.name} -. "#9889; ${signalledBy.signalName}" .-> ${func.name}\n`;
            }
        }

        if (!!func.isCalledByItself) {

            code += `${func.name} -- "[ContinueAsNew]" --> ${func.name}\n`;
        }
    }

    return code;
}

// A DTO used by DurableOrchestrationStatus.historyEvents
export class HistoryEvent {
    Timestamp: string;
    EventType: string;
    Name: string;
    ScheduledTime: string;
    Result: any;
    Details: any;
}

// Could instead just iterate through field names of HistoryEvent, but reflection in TypeScript still looks tricky
export const HistoryEventFields = [
    'Timestamp',
    'EventType',
    'Name',
    'ScheduledTime',
    'Result',
    'Details',
];

export enum OrchestrationStatusEnum {
    Running = 0,
    Completed = 1,
    ContinuedAsNew = 2,
    Failed = 3,
    Canceled = 4,
    Terminated = 5,
    Pending = 6
}

// A DTO returned by DurableOrchestrationClient.getStatusAll()
export class DurableOrchestrationStatus {
    instanceId: string;
    name: string;
    runtimeStatus: OrchestrationStatusEnum;
    lastEvent: string;
    input: any;
    customStatus: string;
    output: any;
    createdTime: string;
    lastUpdatedTime: string;
    historyEvents?: HistoryEvent[];
}

// Could instead just iterate through field names of DurableOrchestrationStatus, but reflection in TypeScript still looks tricky
export const DurableOrchestrationStatusFields = [
    'instanceId',
    'name',
    'createdTime',
    'lastUpdatedTime',
    'runtimeStatus',
    'lastEvent',
    'input',
    'output',
    'customStatus'
];
import * as vscode from 'vscode';

import { StorageConnectionSettings } from './BackendProcess';
import { MonitorView } from "./MonitorView";
import { StorageAccountTreeItem } from "./StorageAccountTreeItem";

// Represents the Task Hub item in the TreeView
export class TaskHubTreeItem extends vscode.TreeItem {

    constructor(private _parentItem: StorageAccountTreeItem, private _hubName: string) {
        super(_hubName);
    }

    // An attached instance of MonitorView (if attached)
    monitorView: MonitorView | null = null;

    // Gets associated storage connection settings
    get storageConnectionSettings(): StorageConnectionSettings {
        return {
            storageConnString: this._parentItem.storageConnString,
            hubName: this._hubName
        };
    }

    // As a tooltip, showing the backend's URL
    get tooltip(): string {

        if (!this.monitorView) {
            return '';
        }

        return this.monitorView.backendProperties ? this.monitorView.backendProperties.backendUrl : '';
    }

    // Something to show to the right of this item
    get description(): string {

        return `Task Hub ${!!this.monitorView ? ' (attached)' : ''}`;
    }

    // This is what happens when the item is being clicked
    get command(): vscode.Command {
        return {
            title: 'Attach',
            command: 'durableFunctionsMonitorTreeView.attachToTaskHub',
            arguments: [this]
        };
    }

    // For binding context menu to this tree node
    get contextValue(): string {
        return (!!this.monitorView) ? 'taskHub-attached' : 'taskHub-detached';
    }

    // For sorting
    static compare(first: TaskHubTreeItem, second: TaskHubTreeItem): number {
        const a = first.label!.toLowerCase();
        const b = second.label!.toLowerCase();
        return a === b ? 0 : (a < b ? -1 : 1);
    }

    // Permanently deletes all underlying Storage resources for this Task Hub and drops it from parent list
    deletePermanently(): Promise<any> {

        return new Promise((resolve, reject) => { 

            this.monitorView!.deleteTaskHub().then(() => {

                this._parentItem.childItems.splice(this._parentItem.childItems.indexOf(this), 1);
                resolve();

            }, err => reject(err.message));
        });
    }
}
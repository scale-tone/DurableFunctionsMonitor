import * as vscode from 'vscode';

import { StorageConnectionSettings } from './BackendProcess';
import { TaskHubTreeItem } from "./TaskHubTreeItem";

// Represents the Storage Account item in the TreeView
export class StorageAccountTreeItem extends vscode.TreeItem {

    constructor(private _connString: string, accountName: string) {
        super(accountName, vscode.TreeItemCollapsibleState.Expanded);
    }

    private _taskHubItems: TaskHubTreeItem[] = [];

    get accountName(): string {
        return this.label!;
    }

    get storageConnString(): string {
        return this._connString;
    }

    get childItems(): TaskHubTreeItem[] {
        return this._taskHubItems;
    }

    get tooltip(): string {
        return StorageConnectionSettings.maskStorageConnString(this._connString);
    }

    // Something to show to the right of this item
    get description(): string {
        return 'Azure Storage Account';
    }

    // For sorting
    static compare(first: StorageAccountTreeItem, second: StorageAccountTreeItem): number {
        const a = first.accountName.toLowerCase();
        const b = second.accountName.toLowerCase();
        return a === b ? 0 : (a < b ? -1 : 1);
    }

    // Creates or returns existing TaskHubTreeItem by hub name
    getOrAdd(name: string): TaskHubTreeItem {

        var hubItem = this._taskHubItems.find(taskHub => taskHub.storageConnectionSettings.hubName.toLowerCase() === name.toLowerCase());
        if (!hubItem) {
            hubItem = new TaskHubTreeItem(this, name);
            this._taskHubItems.push(hubItem);
            this._taskHubItems.sort(TaskHubTreeItem.compare);
        }

        return hubItem;
    }
}
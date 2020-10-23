import * as vscode from 'vscode';
import * as path from 'path';

import { StorageConnectionSettings } from './BackendProcess';
import { TaskHubTreeItem } from "./TaskHubTreeItem";

// Represents the Storage Account item in the TreeView
export class StorageAccountTreeItem extends vscode.TreeItem {

    constructor(private _connString: string, accountName: string, private _resourcesFolderPath: string) {
        super(accountName, vscode.TreeItemCollapsibleState.Expanded);
        this.iconPath = path.join(this._resourcesFolderPath, 'storageAccount.svg');
    }

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
        return `${this._taskHubItems.length} Task Hubs`;
    }

    // For sorting
    static compare(first: StorageAccountTreeItem, second: StorageAccountTreeItem): number {
        const a = first.accountName.toLowerCase();
        const b = second.accountName.toLowerCase();
        return a === b ? 0 : (a < b ? -1 : 1);
    }

    // Creates or returns existing TaskHubTreeItem by hub name
    getOrAdd(hubName: string): TaskHubTreeItem {

        var hubItem = this._taskHubItems.find(taskHub => taskHub.storageConnectionSettings.hubName.toLowerCase() === hubName.toLowerCase());
        if (!hubItem) {
            hubItem = new TaskHubTreeItem(this, hubName, this._resourcesFolderPath);
            this._taskHubItems.push(hubItem);
            this._taskHubItems.sort(TaskHubTreeItem.compare);
        }

        return hubItem;
    }
    
    private _taskHubItems: TaskHubTreeItem[] = [];
}
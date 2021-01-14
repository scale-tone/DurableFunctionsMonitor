import * as vscode from 'vscode';
import * as path from 'path';

import { StorageConnectionSettings } from './BackendProcess';
import { TaskHubTreeItem } from "./TaskHubTreeItem";

// Represents the Storage Account item in the TreeView
export class StorageAccountTreeItem extends vscode.TreeItem {

    constructor(private _connString: string,
        accountName: string,
        private _resourcesFolderPath: string,
        private _getBackendUrl: () => string,
        private _isTaskHubAttached: (hubName: string) => boolean) {
        
        super(accountName, vscode.TreeItemCollapsibleState.Expanded);
    }

    get isAttached(): boolean {
        return !!this.backendUrl;
    }

    get backendUrl(): string {
        return this._getBackendUrl();
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
        return StorageConnectionSettings.MaskStorageConnString(this._connString);
    }

    // Something to show to the right of this item
    get description(): string {
        return `${this._taskHubItems.length} Task Hubs`;
    }

    // Item's icon
    get iconPath(): string {
        return path.join(this._resourcesFolderPath, this.isAttached ? 'storageAccountAttached.svg' : 'storageAccount.svg');
    }

    // For binding context menu to this tree node
    get contextValue(): string {
        return this.isAttached ? 'storageAccount-attached' : 'storageAccount-detached';
    }

    // For sorting
    static compare(first: StorageAccountTreeItem, second: StorageAccountTreeItem): number {
        const a = first.accountName.toLowerCase();
        const b = second.accountName.toLowerCase();
        return a === b ? 0 : (a < b ? -1 : 1);
    }

    // Creates or returns existing TaskHubTreeItem by hub name
    getOrAdd(hubName: string): TaskHubTreeItem {

        var hubItem = this._taskHubItems.find(taskHub => taskHub.hubName.toLowerCase() === hubName.toLowerCase());
        if (!hubItem) {
            hubItem = new TaskHubTreeItem(this, hubName, this._resourcesFolderPath);
            this._taskHubItems.push(hubItem);
            this._taskHubItems.sort(TaskHubTreeItem.compare);
        }

        return hubItem;
    }

    isTaskHubVisible(hubName: string): boolean {
        return this._isTaskHubAttached(hubName);
    }
    
    private _taskHubItems: TaskHubTreeItem[] = [];
}
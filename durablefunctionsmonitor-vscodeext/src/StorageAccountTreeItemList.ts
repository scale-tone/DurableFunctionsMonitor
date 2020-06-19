import { MonitorView } from "./MonitorView";
import { StorageAccountTreeItem } from "./StorageAccountTreeItem";
import { StorageConnectionSettings } from "./BackendProcess";
import { GetAccountNameFromConnectionString } from "./Helpers";

// Represents the list of Storage Account items in the TreeView
export class StorageAccountTreeItemList {

    get nodes(): StorageAccountTreeItem[] {
        return this._storageAccountItems;
    }

    // Adds a node to the tree for MonitorView, that's already running
    addNodeForMonitorView(monitorView: MonitorView): void {

        const storageAccountName = monitorView.backendProperties!.accountName;
        const storageConnString = monitorView.storageConnectionSettings!.storageConnString;

        // Only creating a new tree node, if no node for this account exists so far
        var node = this._storageAccountItems.find(item => item.accountName === storageAccountName);
        if (!node) {
            node = new StorageAccountTreeItem(storageConnString, storageAccountName);
            this._storageAccountItems.push(node);
            this._storageAccountItems.sort(StorageAccountTreeItem.compare);
        }

        // Connect Task Hub item with MonitorView instance
        node.getOrAdd(monitorView.backendProperties!.hubName).monitorView = monitorView;
    }

    // Adds a detached node to the tree for the specified storage connection settings
    addNodeForConnectionSettings(connSettings: StorageConnectionSettings): void {

        // Trying to infer account name from connection string
        const storageAccountName = GetAccountNameFromConnectionString(connSettings.storageConnString);
        if (!storageAccountName) {
            return;
        }

        // Only creating a new tree node, if no node for this account exists so far
        var node = this._storageAccountItems.find(item => item.accountName === connSettings.storageConnString);
        if (!node) {
            node = new StorageAccountTreeItem(connSettings.storageConnString, storageAccountName);
            this._storageAccountItems.push(node);
            this._storageAccountItems.sort(StorageAccountTreeItem.compare);
        }

        // Connect Task Hub item with MonitorView instance
        node.getOrAdd(connSettings.hubName);
    }
    
    private _storageAccountItems: StorageAccountTreeItem[] = [];
}
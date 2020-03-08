import { MonitorView } from "./MonitorView";
import { StorageAccountTreeItem } from "./StorageAccountTreeItem";

// Represents the list of Storage Account items in the TreeView
export class StorageAccountTreeItemList {

    get nodes(): StorageAccountTreeItem[] {
        return this._storageAccountItems;
    }

    addNodeForMonitorView(monitorView: MonitorView) {

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
    
    private _storageAccountItems: StorageAccountTreeItem[] = [];
}
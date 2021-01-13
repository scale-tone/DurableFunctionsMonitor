import { MonitorView } from "./MonitorView";
import { MonitorViewList } from "./MonitorViewList";
import { StorageAccountTreeItem } from "./StorageAccountTreeItem";
import { StorageConnectionSettings } from "./BackendProcess";
import { ConnStringUtils } from "./Helpers";
import { TaskHubTreeItem } from "./TaskHubTreeItem";

// Represents the list of Storage Account items in the TreeView
export class StorageAccountTreeItems {

    constructor(private _resourcesFolderPath: string, private _monitorViewList: MonitorViewList) {}

    get nodes(): StorageAccountTreeItem[] {
        return this._storageAccountItems;
    }

    get taskHubNodes(): TaskHubTreeItem[] {
        return ([] as TaskHubTreeItem[]).concat(...this._storageAccountItems.map(n => n.childItems));
    }

    // Adds a node to the tree for MonitorView, that's already running
    addNodeForMonitorView(monitorView: MonitorView): void {

        const storageConnString = monitorView.storageConnectionSettings.storageConnString;
        const storageAccountName = ConnStringUtils.GetAccountName(storageConnString);

        // Only creating a new tree node, if no node for this account exists so far
        var node = this._storageAccountItems.find(item => item.accountName.toLowerCase() === storageAccountName.toLowerCase());
        if (!node) {

            node = new StorageAccountTreeItem(storageConnString,
                storageAccountName,
                this._resourcesFolderPath,
                s => this._monitorViewList.getBackendUrl(s),
                connSettings => this._monitorViewList.isMonitorViewVisible(connSettings)
            );

            this._storageAccountItems.push(node);
            this._storageAccountItems.sort(StorageAccountTreeItem.compare);
        }

        // Connect Task Hub item with MonitorView instance
        node.getOrAdd(monitorView.storageConnectionSettings.hubName);
    }

    // Adds a detached node to the tree for the specified storage connection settings
    addNodeForConnectionSettings(connSettings: StorageConnectionSettings): void {

        // Trying to infer account name from connection string
        const storageAccountName = ConnStringUtils.GetAccountName(connSettings.storageConnString);
        if (!storageAccountName) {
            return;
        }

        // Only creating a new tree node, if no node for this account exists so far
        var node = this._storageAccountItems.find(item => item.accountName === storageAccountName);
        if (!node) {

            node = new StorageAccountTreeItem(connSettings.storageConnString,
                storageAccountName,
                this._resourcesFolderPath,
                connString => this._monitorViewList.getBackendUrl(connString),
                connSettings => this._monitorViewList.isMonitorViewVisible(connSettings)
            );
 
            this._storageAccountItems.push(node);
            this._storageAccountItems.sort(StorageAccountTreeItem.compare);
        }

        // Connect Task Hub item with MonitorView instance
        node.getOrAdd(connSettings.hubName);
    }
    
    private _storageAccountItems: StorageAccountTreeItem[] = [];
}
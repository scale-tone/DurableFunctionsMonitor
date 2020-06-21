import * as vscode from 'vscode';

import { MonitorViewList } from "./MonitorViewList";
import { StorageAccountTreeItem } from "./StorageAccountTreeItem";
import { StorageAccountTreeItemList } from "./StorageAccountTreeItemList";
import { TaskHubTreeItem } from "./TaskHubTreeItem";

// Root object in the hierarchy. Also serves data for the TreeView.
export class MonitorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> { 

    constructor(context: vscode.ExtensionContext) {
        this._monitorViews = new MonitorViewList(context);
        this._treeItems = new StorageAccountTreeItemList();

        // Also trying to parse current project's files and create a Task Hub node for them
        const connSettingsFromCurrentProject = this._monitorViews.getStorageConnectionSettingsFromCurrentProject();
        if (!!connSettingsFromCurrentProject) {
            this._treeItems.addNodeForConnectionSettings(connSettingsFromCurrentProject);
        }
    }

    // Does nothing, actually
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

    // Returns the children of `element` or root if no element is passed.
    getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {

        if (!element) {
            return Promise.resolve(this._treeItems.nodes);
        }

        const item = element as StorageAccountTreeItem;

        if (this._treeItems.nodes.includes(item)) {
            return Promise.resolve(item.childItems);
        }

        return Promise.resolve([]);
    }

    // Handles 'Attach' context menu item or a click on a tree node
    attachToTaskHub(taskHubItem: TaskHubTreeItem, messageToWebView: any = undefined) {

        if (!!this._inProgress) {
            console.log(`Another operation already in progress...`);
            return;
        }
        this._inProgress = true;

        if (!taskHubItem.monitorView) {
            taskHubItem.monitorView = this._monitorViews.createFromStorageConnectionSettings(taskHubItem.storageConnectionSettings);
        }

        taskHubItem.monitorView.show(messageToWebView).then(() => {
            this._inProgress = false;
            this._onDidChangeTreeData.fire();
        }, (err) => {
            // .finally() doesn't work here - vscode.window.showErrorMessage() blocks it until user 
            // closes the error message. As a result, _inProgress remains true until then, which blocks all commands
            this._inProgress = false;
            vscode.window.showErrorMessage(err);
        });
    }

    // Handles 'Detach' context menu item
    detachFromTaskHub(taskHubItem: TaskHubTreeItem) {

        this.internalDetachFromTaskHub(taskHubItem);
    }

    // Handles 'Delete Task Hub' context menu item
    deleteTaskHub(taskHubItem: TaskHubTreeItem) {

        const prompt = `This will permanently delete all Azure Storage resources used by '${taskHubItem.label}' orchestration service. There should be no running Function instances for this Task Hub present. Are you sure you want to proceed?`;
        vscode.window.showWarningMessage(prompt, 'Yes', 'No').then(answer => {

            if (answer === 'Yes') {
                this.internalDetachFromTaskHub(taskHubItem, () => taskHubItem.deletePermanently());
            }
        });
    }

    // Handles 'Attach' button
    attachToAnotherTaskHub() {

        this.createOrActivateMonitorView(true);
    }

    // Shows or makes active the main view
    showWebView(messageToWebView: any = undefined) {

        this.createOrActivateMonitorView(false, messageToWebView);
    }

    // Stops all backend processes and closes all views
    cleanup(): Promise<any> | undefined {
        return this._monitorViews.cleanup();
    }

    private _inProgress: boolean = false;

    private _monitorViews: MonitorViewList;
    private _treeItems: StorageAccountTreeItemList;

    private _onDidChangeTreeData: vscode.EventEmitter<StorageAccountTreeItem | undefined> = new vscode.EventEmitter<StorageAccountTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<StorageAccountTreeItem | undefined> = this._onDidChangeTreeData.event;

    // Shows or makes active the main view
    private createOrActivateMonitorView(alwaysCreateNew: boolean, messageToWebView: any = undefined) {

        if (!!this._inProgress) {
            console.log(`Another operation already in progress...`);
            return;
        }

        this._monitorViews.getOrAdd(alwaysCreateNew).then(monitorView => {

            this._inProgress = true;

            monitorView.show(messageToWebView).then(() => {

                this._treeItems.addNodeForMonitorView(monitorView);
                this._onDidChangeTreeData.fire();
                this._inProgress = false;

            }, (err) => {
                // .finally() doesn't work here - vscode.window.showErrorMessage() blocks it until user 
                // closes the error message. As a result, _inProgress remains true until then, which blocks all commands
                this._inProgress = false;
                vscode.window.showErrorMessage(err);
            });

        }, vscode.window.showErrorMessage);
    }

    private internalDetachFromTaskHub(taskHubItem: TaskHubTreeItem,
        doBefore: ((taskHubItem: TaskHubTreeItem) => Promise<any>) = () => Promise.resolve()) {

        if (!taskHubItem.monitorView) {
            return;
        }

        if (!!this._inProgress) {
            console.log(`Another operation already in progress...`);
            return;
        }
        this._inProgress = true;

        doBefore(taskHubItem).then(() => {

            const monitorView = taskHubItem.monitorView!;
            taskHubItem.monitorView = null;
            this._monitorViews.remove(monitorView);

            // Stopping backend process
            monitorView.cleanup()!.finally(() => {
                this._inProgress = false;
            });

            this._onDidChangeTreeData.fire();

        }, err => {
            this._inProgress = false;
            vscode.window.showErrorMessage(`Failed to delete Task Hub. ${err}`);
        });
    }
}
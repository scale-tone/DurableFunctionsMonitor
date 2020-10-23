import * as vscode from 'vscode';

import { MonitorViewList } from "./MonitorViewList";
import { StorageAccountTreeItem } from './StorageAccountTreeItem';
import { StorageAccountTreeItems } from './StorageAccountTreeItems';
import { TaskHubTreeItem } from './TaskHubTreeItem';
import { SubscriptionTreeItems } from './SubscriptionTreeItems';
import { SubscriptionTreeItem } from './SubscriptionTreeItem';

import * as settings from './settings.json';

// Name for our logging OutputChannel
const OutputChannelName = 'Durable Functions Monitor';

// Root object in the hierarchy. Also serves data for the TreeView.
export class MonitorTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> { 

    constructor(context: vscode.ExtensionContext) {

        this._monitorViews = new MonitorViewList(context);

        const resourcesFolderPath = context.asAbsolutePath('resources');
        this._storageAccounts = new StorageAccountTreeItems(resourcesFolderPath);

        // Using Azure Account extension to connect to Azure, get subscriptions etc.
        const azureAccountExtension = vscode.extensions.getExtension('ms-vscode.azure-account');

        // Typings for azureAccount are here: https://github.com/microsoft/vscode-azure-account/blob/master/src/azure-account.api.d.ts
        const azureAccount = !!azureAccountExtension ? azureAccountExtension.exports : undefined;
        
        if (!!azureAccount && !!azureAccount.onFiltersChanged) {

            // When user changes their list of filtered subscriptions (or just relogins to Azure)...
            context.subscriptions.push(azureAccount.onFiltersChanged(() => this.refresh()));
        }

        // For logging
        const logChannel = !!settings.logging ? vscode.window.createOutputChannel(OutputChannelName) : undefined;
        if (!!logChannel) {
            context.subscriptions.push(logChannel);
        }

        this._subscriptions = new SubscriptionTreeItems(
            azureAccount,
            this._storageAccounts,
            () => this._onDidChangeTreeData.fire(),
            resourcesFolderPath,
            logChannel
        );

        // Also trying to parse current project's files and create a Task Hub node for them
        const connSettingsFromCurrentProject = this._monitorViews.getStorageConnectionSettingsFromCurrentProject();
        if (!!connSettingsFromCurrentProject) {
            this._storageAccounts.addNodeForConnectionSettings(connSettingsFromCurrentProject);
        }
    }

    // Does nothing, actually
    getTreeItem(element: vscode.TreeItem): vscode.TreeItem { return element; }

    // Returns the children of `element` or root if no element is passed.
    getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {

        if (!element) {
            return this._subscriptions.getNonEmptyNodes();
        }

        const subscriptionNode = element as SubscriptionTreeItem;
        if (subscriptionNode.isSubscriptionTreeItem) {

            const storageAccountNodes = subscriptionNode.storageAccountNodes;

            // Initially collapsing those storage nodes, that don't have attached TaskHubs at the moment
            for (const n of storageAccountNodes) {
                if (n.childItems.every(t => !t.monitorView)) {
                    n.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
                }
            }

            return Promise.resolve(storageAccountNodes);
        }

        // If this is a storage account tree item
        const item = element as StorageAccountTreeItem;
        if (this._storageAccounts.nodes.includes(item)) {
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

    // Handles 'Refresh' button
    refresh() {
        this._subscriptions.cleanup();
        this._onDidChangeTreeData.fire();
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
    private _storageAccounts: StorageAccountTreeItems;
    private _subscriptions: SubscriptionTreeItems;

    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined> = new vscode.EventEmitter<StorageAccountTreeItem | undefined>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined> = this._onDidChangeTreeData.event;

    // Shows or makes active the main view
    private createOrActivateMonitorView(alwaysCreateNew: boolean, messageToWebView: any = undefined) {

        if (!!this._inProgress) {
            console.log(`Another operation already in progress...`);
            return;
        }

        this._monitorViews.getOrAdd(alwaysCreateNew).then(monitorView => {

            this._inProgress = true;

            monitorView.show(messageToWebView).then(() => {

                this._storageAccounts.addNodeForMonitorView(monitorView);
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
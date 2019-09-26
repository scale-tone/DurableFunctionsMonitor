import { observable, computed } from 'mobx'
import axios from 'axios';

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';

export const BackendBaseUri = process.env.REACT_APP_BACKEND_BASE_URI as string;

export enum FilterOperatorEnum {
    Equals = 0,
    StartsWith,
    Contains
}

// State of Orchestrations view
export class OrchestrationsState extends ErrorMessageState {

    @computed
    get inProgress(): boolean { return this._inProgress; }

    @computed
    get orchestrations(): DurableOrchestrationStatus[] { return this._orchestrations; }

    @computed
    get autoRefresh(): number { return this._autoRefresh; }
    set autoRefresh(val: number) {
        this._autoRefresh = val;
        this.loadOrchestrations(true);
    }

    @computed
    get timeFrom(): Date { return this._timeFrom; }
    set timeFrom(val: Date) { this._timeFrom = val; }
    
    @computed
    get timeTill(): Date { return (!this._timeTill) ? new Date() : this._timeTill!; }
    set timeTill(val: Date) { this._timeTill = val; }

    @computed
    get timeTillEnabled(): boolean { return !!this._timeTill; }
    set timeTillEnabled(val: boolean) {

        this._timeTill = val ? new Date() : undefined;

        if (!val) {
            this.reloadOrchestrations();
        }
    }
    
    @computed
    get orderByDirection(): ('asc' | 'desc') { return this._orderByDirection;}

    @computed
    get orderBy() : string { return this._orderBy; }
    set orderBy(val: string) {

        if (this._orderBy !== val)  {
            this._orderBy = val;
        }
        else {
            this._orderByDirection = (this._orderByDirection === 'desc') ? 'asc' : 'desc';
        }

        this.reloadOrchestrations();
    }

    @computed
    get filterValue(): string { return this._filterValue; }
    set filterValue(val: string) { this._filterValue = val; }

    @computed
    get filterOperator(): FilterOperatorEnum { return this._filterOperator; }
    set filterOperator(val: FilterOperatorEnum) {
        
        this._filterOperator = val;

        if (!!this._filterValue && this._filteredColumn !== '0') {

            this.reloadOrchestrations();
        }
    }

    @computed
    get filteredColumn(): string { return this._filteredColumn; }
    set filteredColumn(val: string) {

        this._filteredColumn = val;

        if (!this._filterValue) {
            return;
        }

        if (this._filteredColumn === '0') {
            this._filterValue = '';
        }

        this.reloadOrchestrations();
    }

    constructor(private _getAuthorizationHeaderAsync: () => Promise<{ Authorization: string }>) {
        super();

        const dt = new Date();
        dt.setDate(dt.getDate() - 1);
        this._timeFrom = dt;
    }

    applyTimeFrom() {
        if (this._oldTimeFrom !== this._timeFrom) {
            this.reloadOrchestrations();
        }
    }

    applyTimeTill() {
        if (this._oldTimeTill !== this._timeTill) {
            this.reloadOrchestrations();
        }
    }

    applyFilterValue() {
        if (this._oldFilterValue !== this._filterValue) {
            this.reloadOrchestrations();
        }
    }

    reloadOrchestrations() {
        this._orchestrations = [];
        this._noMorePagesToLoad = false;
        this.loadOrchestrations();

        this._oldFilterValue = this._filterValue;
        this._oldTimeFrom = this._timeFrom;
        this._oldTimeTill = this._timeTill;
    }

    loadOrchestrations(isAutoRefresh: boolean = false) {

        if (!!this.inProgress || (!!this._noMorePagesToLoad && !this._autoRefresh )) {
            return;            
        }
        this._inProgress = true;

        // In auto-refresh mode only refreshing the first page
        const skip = isAutoRefresh ? 0 : this._orchestrations.length;

        const timeTill = !!this._timeTill ? this._timeTill : new Date();
        var filterClause = `&$filter=createdTime ge '${this._timeFrom.toISOString()}' and createdTime le '${timeTill.toISOString()}'`;

        if (!!this._filterValue && this._filteredColumn !== '0') {

            filterClause += ' and ';

            switch (this._filterOperator) {
                case FilterOperatorEnum.Equals:
                    filterClause += `${this._filteredColumn} eq '${this._filterValue}'`;
                break;
                case FilterOperatorEnum.StartsWith:
                    filterClause += `startswith(${this._filteredColumn}, '${this._filterValue}')`;
                break;
                case FilterOperatorEnum.Contains:
                    filterClause += `contains(${this._filteredColumn}, '${this._filterValue}')`;
                break;
            }
        }

        const orderByClause = !!this._orderBy ? `&$orderby=${this._orderBy} ${this.orderByDirection}` : '';

        const uri = `${BackendBaseUri}/orchestrations?$top=${this._pageSize}&$skip=${skip}${filterClause}${orderByClause}`;

        this._getAuthorizationHeaderAsync().then(headers => {
            axios.get(uri, { headers }).then(response => {

                if (!response.data.length) {
                    // Stop the infinite scrolling
                    this._noMorePagesToLoad = true;
                } else {
                    if (isAutoRefresh) {
                        this._orchestrations = response.data;
                    } else {
                        this._orchestrations.push(...response.data);
                    }
                }

                // Doing auto-refresh
                if (!!this._autoRefresh) {

                    if (!!this._autoRefreshToken) {
                        clearTimeout(this._autoRefreshToken);
                    }
                    this._autoRefreshToken = setTimeout(() => this.loadOrchestrations(true), this._autoRefresh * 1000);
                }

            }, err => {

                // Cancelling auto-refresh just in case
                this._autoRefresh = 0;

                this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;

            }).finally(() => {
                this._inProgress = false;
            });
        });
    }

    @observable
    private _inProgress: boolean = false;
    @observable
    private _orchestrations: DurableOrchestrationStatus[] = [];
    @observable
    private _orderByDirection: ('asc' | 'desc') = 'asc';
    @observable
    private _orderBy: string = '';
    @observable
    private _autoRefresh: number = 0;
    @observable
    private _timeFrom: Date;
    @observable
    private _timeTill?: Date;
    @observable
    private _filterValue: string = '';
    @observable
    private _filterOperator: FilterOperatorEnum = FilterOperatorEnum.Equals;
    @observable
    private _filteredColumn: string = '0';

    private _noMorePagesToLoad: boolean = false;
    private readonly _pageSize = 50;
    private _autoRefreshToken: NodeJS.Timeout;
    private _oldFilterValue: string = '';
    private _oldTimeFrom: Date;
    private _oldTimeTill?: Date;
}
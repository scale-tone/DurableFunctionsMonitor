import { observable, computed } from 'mobx'

import { DurableOrchestrationStatus } from '../states/DurableOrchestrationStatus';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';

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
        this._localStorage.setItem('autoRefresh', this._autoRefresh.toString());
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

    @computed
    get showLastEventColumn(): boolean {
        // Only showing lastEvent field when being filtered by it (because otherwise it is not populated on the server)
        return this._filteredColumn === 'lastEvent' && (!!this._oldFilterValue);
    }
    
    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(private _backendClient: IBackendClient, private _localStorage: ITypedLocalStorage<OrchestrationsState>) {
        super();

        var timeFrom: Date;
        const timeFromString = this._localStorage.getItem('timeFrom');
        if (!!timeFromString) {
            timeFrom = new Date(timeFromString);
        } else {
            // By default setting it to 24 hours ago
            timeFrom = new Date();
            timeFrom.setDate(timeFrom.getDate() - 1);
        }
        this._timeFrom = timeFrom;
        this._oldTimeFrom = timeFrom;

        const timeTillString = this._localStorage.getItem('timeTill');
        if (!!timeTillString) {
            this._timeTill = new Date(timeTillString);
            this._oldTimeTill = this._timeTill;
        }

        const filteredColumnString = this._localStorage.getItem('filteredColumn');
        if (!!filteredColumnString) {
            this._filteredColumn = filteredColumnString;
        }

        const filterOperatorString = this._localStorage.getItem('filterOperator');
        if (!!filterOperatorString) {
            this._filterOperator = FilterOperatorEnum[filterOperatorString];
        }

        const filterValueString = this._localStorage.getItem('filterValue');
        if (!!filterValueString) {
            this._filterValue = filterValueString;
            this._oldFilterValue = filterValueString;
        }

        const autoRefreshString = this._localStorage.getItem('autoRefresh');
        if (!!autoRefreshString) {
            this._autoRefresh = Number(autoRefreshString);
        }
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

        // persisting state as a batch
        this._localStorage.setItems([
            { fieldName: 'timeFrom', value: this._timeFrom.toISOString() },
            { fieldName: 'timeTill', value: !!this._timeTill ? this._timeTill.toISOString() : null },
            { fieldName: 'timeFrom', value: this._timeFrom.toISOString() },
            { fieldName: 'filteredColumn', value: this._filteredColumn },
            { fieldName: 'filterOperator', value: FilterOperatorEnum[this._filterOperator] },
            { fieldName: 'filterValue', value: !!this._filterValue ? this._filterValue : null },
        ]);

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

        const uri = `/orchestrations?$top=${this._pageSize}&$skip=${skip}${filterClause}${orderByClause}`;

        this._backendClient.call('GET', uri).then(response => {

            if (!response.length) {
                // Stop the infinite scrolling
                this._noMorePagesToLoad = true;
            } else {
                if (isAutoRefresh) {
                    this._orchestrations = response;
                } else {
                    this._orchestrations.push(...response);
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
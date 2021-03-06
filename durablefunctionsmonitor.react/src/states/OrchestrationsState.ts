import { observable, computed } from 'mobx'
import moment from 'moment';

import { DateTimeHelpers } from '../DateTimeHelpers';
import { ErrorMessageState } from './ErrorMessageState';
import { IBackendClient } from '../services/IBackendClient';
import { ITypedLocalStorage } from './ITypedLocalStorage';
import { CancelToken } from '../CancelToken';
import { IResultsTabState, ResultsListTabState } from './ResultsListTabState';
import { ResultsGanttDiagramTabState } from './ResultsGanttDiagramTabState';
import { ResultsHistogramTabState } from './ResultsHistogramTabState';

export enum FilterOperatorEnum {
    Equals = 0,
    StartsWith,
    Contains
}

export enum ShowEntityTypeEnum {
    ShowBoth = 0,
    OrchestrationsOnly,
    DurableEntitiesOnly
}

export enum ResultsTabEnum {
    List = 0,
    Histogram,
    Gantt
}

// State of Orchestrations view
export class OrchestrationsState extends ErrorMessageState {

    // Tab currently selected
    @computed
    get selectedTabIndex(): ResultsTabEnum { return this._selectedTabIndex; }
    set selectedTabIndex(val: ResultsTabEnum) {

        if (this._selectedTabIndex === val) {
            return;
        }

        this._selectedTabIndex = val;
        this.reloadOrchestrations();
    }

    get selectedTabState(): IResultsTabState {
        return this._tabStates[this._selectedTabIndex];
    }

    @computed
    get inProgress(): boolean { return this._cancelToken.inProgress && !this._cancelToken.isCancelled; }

    @computed
    get autoRefresh(): number { return this._autoRefresh; }
    set autoRefresh(val: number) {
        this._autoRefresh = val;
        this._localStorage.setItem('autoRefresh', this._autoRefresh.toString());
        this.loadOrchestrations(true);
    }

    @computed
    get timeFrom(): moment.Moment { return this._timeFrom; }
    set timeFrom(val: moment.Moment) {
        this._timeFrom = val;
        this.listState.resetOrderBy();
    }

    @computed
    get timeTill(): moment.Moment { return (!this._timeTill) ? moment().utc() : this._timeTill; }
    set timeTill(val: moment.Moment) {
        this._timeTill = val;
        this.listState.resetOrderBy();
    }
    
    @computed
    get timeTillEnabled(): boolean { return !!this._timeTill; }
    set timeTillEnabled(val: boolean) {

        this._timeTill = val ? moment().utc() : null;

        if (!val) {
            this.listState.resetOrderBy();
            this.reloadOrchestrations();
        }
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
    get showEntityType(): string { return ShowEntityTypeEnum[this._showEntityType]; }
    set showEntityType(val: string) {

        this._showEntityType = ShowEntityTypeEnum[val];

        this.reloadOrchestrations();
    }

    @computed
    get showLastEventColumn(): boolean {
        // Only showing lastEvent field when being filtered by it (because otherwise it is not populated on the server)
        return this._filteredColumn === 'lastEvent' && (!!this._oldFilterValue);
    }
    
    get backendClient(): IBackendClient { return this._backendClient; }

    constructor(private _backendClient: IBackendClient, private _localStorage: ITypedLocalStorage<OrchestrationsState & ResultsListTabState>) {
        super();
        
        var momentFrom: moment.Moment;
        const timeFromString = this._localStorage.getItem('timeFrom');
        if (!!timeFromString) {
            momentFrom = moment(timeFromString);
        } else {
            // By default setting it to 24 hours ago
            momentFrom = moment().subtract(1, 'days');
        }
        momentFrom.utc();

        this._timeFrom = momentFrom;
        this._oldTimeFrom = momentFrom;
       
        const timeTillString = this._localStorage.getItem('timeTill');
        if (!!timeTillString) {
            this._timeTill = moment(timeTillString);
            this._timeTill.utc();
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

        const showEntityTypeString = this._localStorage.getItem('showEntityType');
        if (!!showEntityTypeString) {
            this._showEntityType = ShowEntityTypeEnum[showEntityTypeString];
        }

        const autoRefreshString = this._localStorage.getItem('autoRefresh');
        if (!!autoRefreshString) {
            this._autoRefresh = Number(autoRefreshString);
        }
    }

    applyTimeFrom() {
        if (DateTimeHelpers.isValidMoment(this._timeFrom) && this._oldTimeFrom !== this._timeFrom) {
            this.reloadOrchestrations();
        }
    }

    applyTimeTill() {
        if (DateTimeHelpers.isValidMoment(this._timeTill) && this._oldTimeTill !== this._timeTill) {
            this.reloadOrchestrations();
        }
    }

    applyFilterValue() {
        if (this._oldFilterValue !== this._filterValue) {
            this.reloadOrchestrations();
        }
    }

    reloadOrchestrations() {

        for (const resultState of this._tabStates) {
            resultState.reset();
        }

        // If dates are invalid, reverting them to previous valid values
        if (!DateTimeHelpers.isValidMoment(this._timeFrom)) {
            this._timeFrom = this._oldTimeFrom;
        }
        if (!!this._timeTill && !DateTimeHelpers.isValidMoment(this._timeTill)) {
            this._timeTill = this._oldTimeTill;
        }

        // persisting state as a batch
        this._localStorage.setItems([
            { fieldName: 'timeFrom', value: this._timeFrom.toISOString() },
            { fieldName: 'timeTill', value: !!this._timeTill ? this._timeTill.toISOString() : null },
            { fieldName: 'filteredColumn', value: this._filteredColumn },
            { fieldName: 'filterOperator', value: FilterOperatorEnum[this._filterOperator] },
            { fieldName: 'filterValue', value: !!this._filterValue ? this._filterValue : null },
            { fieldName: 'showEntityType', value: ShowEntityTypeEnum[this._showEntityType] },
        ]);

        this.loadOrchestrations();

        this._oldFilterValue = this._filterValue;
        this._oldTimeFrom = this._timeFrom;
        this._oldTimeTill = this._timeTill;
    }

    cancel() {
        this._cancelToken.isCancelled = true;
        this._cancelToken = new CancelToken();
    }

    loadOrchestrations(isAutoRefresh: boolean = false) {

        const cancelToken = this._cancelToken;
        if (!!cancelToken.inProgress) {
            return;            
        }
        cancelToken.inProgress = true;
        
        const timeFrom = this._timeFrom.toISOString();
        const timeTill = !!this._timeTill ? this._timeTill.toISOString() : moment().utc().toISOString();
        var filterClause = `&$filter=createdTime ge '${timeFrom}' and createdTime le '${timeTill}'`;

        if (this._showEntityType === ShowEntityTypeEnum.OrchestrationsOnly) {
            filterClause += ` and entityType eq 'Orchestration'`;
        }
        else if (this._showEntityType === ShowEntityTypeEnum.DurableEntitiesOnly) {
            filterClause += ` and entityType eq 'DurableEntity'`;
        }
        
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

        this.selectedTabState.load(filterClause, cancelToken, isAutoRefresh).then(() => {

            if (!!this._autoRefreshToken) {
                clearTimeout(this._autoRefreshToken);
            }

            // Doing auto-refresh
            if (!!this._autoRefresh) {

                this._autoRefreshToken = setTimeout(() => {

                    this.loadOrchestrations(true);

                }, this._autoRefresh * 1000);
            }

        }, err => {

            // Cancelling auto-refresh just in case
            this._autoRefresh = 0;

            if (!cancelToken.isCancelled) {
                this.errorMessage = `Load failed: ${err.message}.${(!!err.response ? err.response.data : '')} `;
            }
                
        }).finally(() => {
            cancelToken.inProgress = false;
        });
    }

    @observable
    private _selectedTabIndex: ResultsTabEnum = ResultsTabEnum.List;

    @observable
    private _cancelToken: CancelToken = new CancelToken();

    @observable
    private _autoRefresh: number = 0;

    @observable
    private _timeFrom: moment.Moment;
    @observable
    private _timeTill: moment.Moment;

    @observable
    private _filterValue: string = '';
    @observable
    private _filterOperator: FilterOperatorEnum = FilterOperatorEnum.Equals;
    @observable
    private _filteredColumn: string = '0';
    @observable
    private _showEntityType: ShowEntityTypeEnum = ShowEntityTypeEnum.ShowBoth;

    private readonly _tabStates: IResultsTabState[] = [
        new ResultsListTabState(this._backendClient, this._localStorage, () => this.reloadOrchestrations()),
        new ResultsHistogramTabState(this._backendClient, this),
        new ResultsGanttDiagramTabState(this._backendClient)
    ];

    private get listState(): ResultsListTabState { return this._tabStates[0] as ResultsListTabState; }

    private _autoRefreshToken: NodeJS.Timeout;
    private _oldFilterValue: string = '';

    private _oldTimeFrom: moment.Moment;
    private _oldTimeTill: moment.Moment;
}
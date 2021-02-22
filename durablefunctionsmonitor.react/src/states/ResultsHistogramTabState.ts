import { observable, computed } from 'mobx'
import moment from 'moment';

import { DurableOrchestrationStatus } from './DurableOrchestrationStatus';
import { IBackendClient } from '../services/IBackendClient';
import { CancelToken } from '../CancelToken';
import { IResultsTabState } from './ResultsListTabState';

type HistogramColumn = { x0: number, x: number, y: number };

// Resulting list of orchestrations represented as a Gantt chart
export class ResultsHistogramTabState implements IResultsTabState {

    @computed
    get zoomedIn() { return this._zoomedIn; }

    @computed
    get histogram() { return this._histogram; }

    @computed
    get numOfInstancesShown() { return this._numOfInstancesShown; }

    get timeRangeInMs() { return this._filterState.timeTill.valueOf() - this._filterState.timeFrom.valueOf(); }

    constructor(private _backendClient: IBackendClient,
        private _filterState: {
            timeFrom: moment.Moment,
            timeTill: moment.Moment, reloadOrchestrations: () => void,
            cancel: () => void
        })
    {
    }

    reset() {

        this._numOfInstancesShown = 0;
        this._histogram = [];
    }

    load(filterClause: string, cancelToken: CancelToken, isAutoRefresh: boolean): Promise<void> {

        if (!this._applyingZoom && !this._zoomedIn) {

            this._initialTimeInterval = { from: this._filterState.timeFrom, till: this._filterState.timeTill };
        }

        this._numOfInstancesShown = 0;

        const startTime = this._filterState.timeFrom.valueOf();
        var bucketLength = Math.ceil((this._filterState.timeTill.valueOf() - startTime) / this._numOfIntervals);
        if (bucketLength <= 0) {
            bucketLength = 1;
        }

        const histogram: HistogramColumn[] = [];
        for (var i = 0; i < this._numOfIntervals; i++) {

            histogram[i] = { x0: startTime + i * bucketLength, x: startTime + (i + 1) * bucketLength, y: 0 };
        }
        this._histogram = histogram;                

        return this.loadNextBatch(filterClause, startTime, bucketLength, 0, cancelToken);
    }

    applyZoom(left: Date, right: Date) {

        this._numOfInstancesShown = 0;

        this._filterState.cancel();
        
        // rounding to next second
        const from = Math.floor(left.getTime() / 1000) * 1000;
        const till = Math.ceil(right.getTime() / 1000) * 1000;

        this._filterState.timeFrom = moment(from).utc();
        this._filterState.timeTill = moment(till).utc();

        this._applyingZoom = true;
        try {
            this._filterState.reloadOrchestrations();
        } finally {
            this._applyingZoom = false;
        }

        this._zoomedIn = true;
    }

    resetZoom() {

        if (!this._zoomedIn || !this._initialTimeInterval) {
            return;
        }

        this._zoomedIn = false;

        this._filterState.cancel();

        this._filterState.timeFrom = this._initialTimeInterval.from;
        this._filterState.timeTill = this._initialTimeInterval.till;
        this._initialTimeInterval = null;

        this._filterState.reloadOrchestrations();
    }

    @observable
    private _histogram: HistogramColumn[] = [];

    @observable
    private _numOfInstancesShown: number = 0;

    @observable
    private _zoomedIn = false;

    private _applyingZoom = false;
    private _initialTimeInterval: { from: moment.Moment, till: moment.Moment } = null;

    private readonly _numOfIntervals = 200;
    private readonly _pageSize = 1000;

    private loadNextBatch(filterClause: string, startTime: number, bucketLength: number, pageNumber: number, cancelToken: CancelToken): Promise<void> {

        const hiddenColumnsClause = `&hidden-columns=history|input|output|customStatus|lastEvent`;

        const uri = `/orchestrations?$top=${this._pageSize}&$skip=${this._numOfInstancesShown}${hiddenColumnsClause}${filterClause}`;

        const promise = this._backendClient.call('GET', uri).then((instances: DurableOrchestrationStatus[]) => {

            if (cancelToken.isCancelled || !instances.length) {
                return Promise.resolve();
            }

            for (var instance of instances) {

                const instanceStartPos = Math.floor((new Date(instance.createdTime).getTime() - startTime) / bucketLength);
                if (instanceStartPos < 0 || instanceStartPos >= this._numOfIntervals || !this._histogram[instanceStartPos]) {
                    continue;
                }

                this._histogram[instanceStartPos].y++;
            }

            this._numOfInstancesShown += instances.length;

            return this.loadNextBatch(filterClause, startTime, bucketLength, pageNumber + 1, cancelToken);
        });

        return promise;
    }
}


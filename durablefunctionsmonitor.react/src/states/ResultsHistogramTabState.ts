import { observable, computed } from 'mobx'
import moment from 'moment';

import { DurableOrchestrationStatus } from './DurableOrchestrationStatus';
import { IBackendClient } from '../services/IBackendClient';
import { CancelToken } from '../CancelToken';
import { IResultsTabState } from './ResultsListTabState';

type HistogramColumn = { x0: number, x: number, y: number };
type TimeInterval = { timeFrom: moment.Moment, timeTill: moment.Moment };

// Resulting list of orchestrations represented as a Gantt chart
export class ResultsHistogramTabState implements IResultsTabState {

    @computed
    get zoomedIn() { return this._zoomedIn; }

    @computed
    get histograms() { return this._histograms; }

    @computed
    get numOfInstancesShown() { return this._numOfInstancesShown; }

    constructor(private _backendClient: IBackendClient,
        private _filterState: TimeInterval & { reloadOrchestrations: () => void, cancel: () => void })
    {
    }

    reset() {

        this._numOfInstancesShown = 0;
        this._histograms = {};
    }

    load(filterClause: string, cancelToken: CancelToken, isAutoRefresh: boolean): Promise<void> {

        if (!this._applyingZoom && !this._zoomedIn) {

            this._originalTimeInterval = { timeFrom: this._filterState.timeFrom, timeTill: this._filterState.timeTill };
        }

        this._numOfInstancesShown = 0;

        const startTime = this._filterState.timeFrom.valueOf();
        var bucketLength = Math.ceil((this._filterState.timeTill.valueOf() - startTime) / this._numOfIntervals);
        if (bucketLength <= 0) {
            bucketLength = 1;
        }

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

        if (!this._zoomedIn || !this._originalTimeInterval) {
            return;
        }

        this._zoomedIn = false;

        this._filterState.cancel();

        this._filterState.timeFrom = this._originalTimeInterval.timeFrom;
        this._filterState.timeTill = this._originalTimeInterval.timeTill;
        this._originalTimeInterval = null;

        this._filterState.reloadOrchestrations();
    }

    @observable
    private _histograms: { [typeName: string]: HistogramColumn[]; } = {};

    @observable
    private _numOfInstancesShown: number = 0;

    @observable
    private _zoomedIn = false;

    private _originalTimeInterval: TimeInterval = null;
    private _applyingZoom = false;

    private readonly _numOfIntervals = 200;
    private readonly _pageSize = 1000;

    private loadNextBatch(filterClause: string, startTime: number, bucketLength: number, pageNumber: number, cancelToken: CancelToken): Promise<void> {

        const uri = `/orchestrations?$top=${this._pageSize}&$skip=${this._numOfInstancesShown}${filterClause}`;

        const promise = this._backendClient.call('GET', uri).then((instances: DurableOrchestrationStatus[]) => {

            if (cancelToken.isCancelled) {
                return Promise.resolve();
            }

            for (var instance of instances) {

                const instanceTypeName = instance.entityType === 'DurableEntity' ? instance.entityId.name : instance.name;

                if (!this._histograms[instanceTypeName]) {
                    
                    const emptyHistogram = [];
                    for (var i = 0; i < this._numOfIntervals; i++) {
                        emptyHistogram[i] = { x0: startTime + i * bucketLength, x: startTime + (i + 1) * bucketLength, y: 0 };
                    }
                    this._histograms[instanceTypeName] = emptyHistogram;
                }

                const instanceStartPos = Math.floor((new Date(instance.createdTime).getTime() - startTime) / bucketLength);
                if (instanceStartPos < 0 || instanceStartPos >= this._numOfIntervals) {
                    continue;
                }

                this._histograms[instanceTypeName][instanceStartPos].y += 1;
            }

            this._numOfInstancesShown += instances.length;

            if (instances.length === this._pageSize) {
                
                return this.loadNextBatch(filterClause, startTime, bucketLength, pageNumber + 1, cancelToken);
            }
        });

        return promise;
    }
}
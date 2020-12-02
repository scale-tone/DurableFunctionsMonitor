import { ITypedLocalStorage } from './ITypedLocalStorage';

// A global variable declared in index.html and replaced by VsCode extension
declare const StateFromVsCode: {};

// Stores field values in VsCode
export class VsCodeTypedLocalStorage<T> implements ITypedLocalStorage<T>
{
    constructor(private _prefix: string, private _vsCodeApi: any) { 
    }

    setItem(fieldName: Extract<keyof T, string>, value: string) {

        StateFromVsCode[`${this._prefix}::${fieldName}`] = value;
        this._vsCodeApi.postMessage({ method: 'PersistState', data: StateFromVsCode });
    }

    setItems(items: { fieldName: Extract<keyof T, string>, value: string | null }[]) {

        for (const item of items) {

            if (item.value === null) {
                delete StateFromVsCode[`${this._prefix}::${item.fieldName}`];
            } else {
                StateFromVsCode[`${this._prefix}::${item.fieldName}`] = item.value;
            }
        }

        this._vsCodeApi.postMessage({ method: 'PersistState', data: StateFromVsCode });
    }

    getItem(fieldName: Extract<keyof T, string>): string | null {
        return StateFromVsCode[`${this._prefix}::${fieldName}`];
    }

    removeItem(fieldName: Extract<keyof T, string>) {

        delete StateFromVsCode[`${this._prefix}::${fieldName}`];
        this._vsCodeApi.postMessage({ method: 'PersistState', data: StateFromVsCode });
    }
}

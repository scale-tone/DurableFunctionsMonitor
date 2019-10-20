import { ITypedLocalStorage } from './ITypedLocalStorage';

// Stores field values in VsCode
export class VsCodeTypedLocalStorage<T> implements ITypedLocalStorage<T>
{
    constructor(private _prefix: string, private _vsCodeApi: any) { 

        const oldState = this._vsCodeApi.getState();
        VsCodeTypedLocalStorage.State = !oldState ? {} : oldState;
    }

    setItem(fieldName: Extract<keyof T, string>, value: string) {

        VsCodeTypedLocalStorage.State[`${this._prefix}::${fieldName}`] = value;
        this._vsCodeApi.setState(VsCodeTypedLocalStorage.State);
    }

    setItems(items: { fieldName: Extract<keyof T, string>, value: string | null }[]) {

        for (const item of items) {

            if (item.value === null) {
                delete VsCodeTypedLocalStorage.State[`${this._prefix}::${item.fieldName}`];
            } else {
                VsCodeTypedLocalStorage.State[`${this._prefix}::${item.fieldName}`] = item.value;
            }
        }
        this._vsCodeApi.setState(VsCodeTypedLocalStorage.State);
    }

    getItem(fieldName: Extract<keyof T, string>): string | null {
        return VsCodeTypedLocalStorage.State[`${this._prefix}::${fieldName}`];
    }

    removeItem(fieldName: Extract<keyof T, string>) {

        delete VsCodeTypedLocalStorage.State[`${this._prefix}::${fieldName}`];
        this._vsCodeApi.setState(VsCodeTypedLocalStorage.State);
    }

    private static State = {};
}

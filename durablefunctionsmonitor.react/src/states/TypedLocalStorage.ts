import { ITypedLocalStorage } from './ITypedLocalStorage';

// Stores field values in a localStorage
export class TypedLocalStorage<T> implements ITypedLocalStorage<T>
{
    constructor(private _prefix: string) { }

    setItem(fieldName: Extract<keyof T, string>, value: string) {
        localStorage.setItem(`${this._prefix}::${fieldName}`, value);
    }

    setItems(items: { fieldName: Extract<keyof T, string>, value: string | null }[]) {
        for (const item of items) {
            if (item.value === null) {
                localStorage.removeItem(`${this._prefix}::${item.fieldName}`);
            } else {
                localStorage.setItem(`${this._prefix}::${item.fieldName}`, item.value);
            }
        }
    }

    getItem(fieldName: Extract<keyof T, string>): string | null {
        return localStorage.getItem(`${this._prefix}::${fieldName}`);
    }

    removeItem(fieldName: Extract<keyof T, string>) {
        localStorage.removeItem(`${this._prefix}::${fieldName}`);
    }
}

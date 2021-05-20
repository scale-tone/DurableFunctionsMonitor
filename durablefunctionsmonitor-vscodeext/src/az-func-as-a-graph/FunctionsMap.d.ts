
export type FunctionsMap = {
    [name: string]: {
        bindings: any[],
        isCalledBy: string[],
        isSignalledBy: { name: string, signalName: string }[],
        isCalledByItself?: boolean,
        filePath?: string,
        pos?: number
    }
};

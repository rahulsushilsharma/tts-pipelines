declare class ModelCache {
    dbName: string;
    storeName: string;
    version: number;
    db: IDBDatabase | null;
    constructor();
    init(): Promise<unknown>;
    get(url: IDBValidKey | IDBKeyRange): Promise<unknown>;
    set(url: any, data: ArrayBuffer): Promise<void>;
    delete(url: IDBValidKey | IDBKeyRange): Promise<void>;
    clear(): Promise<void>;
}
export declare function cachedFetch(url: string | number | Date | ArrayBuffer | ArrayBufferView<ArrayBuffer> | IDBValidKey[] | IDBKeyRange | Request | URL): Promise<Response>;
export default ModelCache;
//# sourceMappingURL=model-cache.d.ts.map
declare class ModelCache {
    dbName: string;
    storeName: string;
    version: number;
    db: IDBDatabase | null;
    init(): Promise<unknown>;
    get(url: string): Promise<ArrayBuffer | null>;
    set(url: string, data: ArrayBuffer): Promise<void>;
    delete(url: string): Promise<void>;
}
interface CacheEntry {
    url: string;
    filePath: string;
    mimeType: string;
    timestamp: number;
}
declare class NodeCache {
    baseDir: string;
    manifestPath: string;
    manifest: Record<string, CacheEntry>;
    maxAge: number;
    constructor(baseDir?: string);
    private _loadManifest;
    private _saveManifest;
    private _sanitizeFileName;
    private _inferExtension;
    get(url: string): Promise<ArrayBuffer | null>;
    set(url: string, data: ArrayBuffer, mimeType?: string): Promise<void>;
    getLocalPath(url: string): string | null;
}
export declare function cachedFetch(url: string, env?: "browser" | "node"): Promise<Response>;
export { ModelCache, NodeCache };
//# sourceMappingURL=model-cache.d.ts.map
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
    initialized: boolean;
    constructor(baseDir?: string);
    init(): Promise<void>;
    _loadManifest(): Promise<Record<string, CacheEntry>>;
    _saveManifest(): Promise<void>;
    _sanitizeFileName(url: string, mimeType?: string): string;
    _inferExtension(mimeType: string): string;
    get(url: string): Promise<ArrayBuffer | null>;
    set(url: string, data: ArrayBuffer, mimeType?: string): Promise<void>;
    getLocalPath(url: string): Promise<string | null>;
}
export declare function cachedFetch(url: string): Promise<Response>;
export { ModelCache, NodeCache };
//# sourceMappingURL=model-cache.d.ts.map
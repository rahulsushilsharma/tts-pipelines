// cache.ts
import fs from "fs";
import path from "path";
// ===================
// Browser IndexedDB Cache
// ===================
class ModelCache {
    dbName = "kitten-tts-cache";
    storeName = "models";
    version = 1;
    db = null;
    async init() {
        if (this.db)
            return this.db;
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, {
                        keyPath: "url",
                    });
                    store.createIndex("timestamp", "timestamp", { unique: false });
                }
            };
        });
    }
    async get(url) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db)
                return reject(new Error("IndexedDB not initialized"));
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(url);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const maxAge = 7 * 24 * 60 * 60 * 1000;
                    if (Date.now() - result.timestamp < maxAge) {
                        resolve(result.data);
                    }
                    else {
                        this.delete(url);
                        resolve(null);
                    }
                }
                else
                    resolve(null);
            };
        });
    }
    async set(url, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db)
                return reject(new Error("IndexedDB not initialized"));
            const tx = this.db.transaction([this.storeName], "readwrite");
            const store = tx.objectStore(this.storeName);
            const req = store.put({ url, data, timestamp: Date.now() });
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve();
        });
    }
    async delete(url) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db)
                return reject(new Error("IndexedDB not initialized"));
            const tx = this.db.transaction([this.storeName], "readwrite");
            const store = tx.objectStore(this.storeName);
            const req = store.delete(url);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve();
        });
    }
}
class NodeCache {
    baseDir;
    manifestPath;
    manifest;
    maxAge;
    constructor(baseDir = ".cache/kitten-tts") {
        this.baseDir = path.resolve(baseDir);
        this.manifestPath = path.join(this.baseDir, "cache-manifest.json");
        this.maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (!fs.existsSync(this.baseDir))
            fs.mkdirSync(this.baseDir, { recursive: true });
        this.manifest = this._loadManifest();
    }
    _loadManifest() {
        try {
            if (fs.existsSync(this.manifestPath)) {
                return JSON.parse(fs.readFileSync(this.manifestPath, "utf8"));
            }
        }
        catch (err) {
            console.warn("Failed to load manifest:", err);
        }
        return {};
    }
    _saveManifest() {
        fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
    }
    _sanitizeFileName(url, mimeType = "application/octet-stream") {
        const ext = this._inferExtension(mimeType);
        const hash = Buffer.from(url).toString("base64").replace(/[^\w]/g, "");
        return `${hash}.${ext}`;
    }
    _inferExtension(mimeType) {
        const map = {
            "application/octet-stream": "bin",
            "application/wasm": "wasm",
            "application/json": "json",
            "application/javascript": "js",
            "text/plain": "txt",
            "text/html": "html",
            "audio/wav": "wav",
            "audio/mpeg": "mp3",
            "audio/ogg": "ogg",
            "model/onnx": "onnx",
        };
        return map[mimeType] || mimeType.split("/").pop() || "bin";
    }
    async get(url) {
        const entry = this.manifest[url];
        if (!entry)
            return null;
        if (!fs.existsSync(entry.filePath)) {
            delete this.manifest[url];
            this._saveManifest();
            return null;
        }
        const age = Date.now() - entry.timestamp;
        if (age > this.maxAge) {
            fs.unlinkSync(entry.filePath);
            delete this.manifest[url];
            this._saveManifest();
            return null;
        }
        const buffer = fs.readFileSync(entry.filePath);
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }
    async set(url, data, mimeType = "application/octet-stream") {
        const fileName = this._sanitizeFileName(url, mimeType);
        const filePath = path.join(this.baseDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(data));
        this.manifest[url] = {
            url,
            filePath,
            mimeType,
            timestamp: Date.now(),
        };
        this._saveManifest();
    }
    getLocalPath(url) {
        const entry = this.manifest[url];
        return entry && fs.existsSync(entry.filePath) ? entry.filePath : null;
    }
}
// ===================
// Unified Cached Fetch
// ===================
export async function cachedFetch(url, env = typeof window === "undefined" ? "node" : "browser") {
    const cache = env === "node" ? new NodeCache() : new ModelCache();
    // Try cache first
    const cachedData = await cache.get(url);
    if (cachedData) {
        const headers = new Headers();
        if (env === "node" && cache instanceof NodeCache) {
            const entry = cache.manifest[url];
            if (entry?.mimeType)
                headers.set("Content-Type", entry.mimeType);
        }
        return new Response(cachedData, { headers });
    }
    // Otherwise fetch from network
    const response = await fetch(url);
    if (!response.ok)
        throw new Error(`HTTP error: ${response.status}`);
    const data = await response.arrayBuffer();
    const mimeType = response.headers.get("Content-Type") || "application/octet-stream";
    if (env === "node" && cache instanceof NodeCache) {
        await cache.set(url, data, mimeType);
    }
    else if (cache instanceof ModelCache) {
        await cache.set(url, data);
    }
    return new Response(data, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}
export { ModelCache, NodeCache };

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cachedFetch = cachedFetch;
// Simple IndexedDB cache for model files
class ModelCache {
    dbName;
    storeName;
    version;
    db;
    constructor() {
        this.dbName = "kitten-tts-cache";
        this.storeName = "models";
        this.version = 1;
        this.db = null;
    }
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
            if (!this.db) {
                reject(new Error("IndexedDB not initialized"));
                return;
            }
            const transaction = this.db.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(url);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    // Check if cache is still valid (7 days)
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                    if (Date.now() - result.timestamp < maxAge) {
                        resolve(result.data);
                        return;
                    }
                    else {
                        // Cache expired, remove it
                        this.delete(url);
                    }
                }
                resolve(null);
            };
        });
    }
    async set(url, data) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("IndexedDB not initialized"));
                return;
            }
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.put({
                url,
                data,
                timestamp: Date.now(),
            });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    async delete(url) {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("IndexedDB not initialized"));
                return;
            }
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(url);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    async clear() {
        await this.init();
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error("IndexedDB not initialized"));
                return;
            }
            const transaction = this.db.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}
// Cached fetch function for model files
async function cachedFetch(url) {
    const cache = new ModelCache();
    // Normalize url to a valid IndexedDB key
    let cacheKey;
    if (typeof url === "string" ||
        typeof url === "number" ||
        url instanceof Date) {
        cacheKey = url;
    }
    else if (url instanceof URL) {
        cacheKey = url.toString();
    }
    else if (url instanceof Request) {
        cacheKey = url.url;
    }
    else if (url instanceof ArrayBuffer || ArrayBuffer.isView(url)) {
        cacheKey = JSON.stringify(Array.from(new Uint8Array(url instanceof ArrayBuffer ? url : url.buffer)));
    }
    else if (Array.isArray(url)) {
        cacheKey = JSON.stringify(url);
    }
    else {
        cacheKey = String(url);
    }
    // Try to get from cache first
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
        return new Response(cachedData);
    }
    // Fetch from network
    let fetchUrl;
    if (typeof url === "string") {
        fetchUrl = url;
    }
    else if (url instanceof URL) {
        fetchUrl = url.toString();
    }
    else if (url instanceof Request) {
        fetchUrl = url;
    }
    else if (typeof url === "number" || url instanceof Date) {
        fetchUrl = String(url);
    }
    else if (url instanceof ArrayBuffer || ArrayBuffer.isView(url)) {
        fetchUrl = JSON.stringify(Array.from(new Uint8Array(url instanceof ArrayBuffer ? url : url.buffer)));
    }
    else if (Array.isArray(url)) {
        fetchUrl = JSON.stringify(url);
    }
    else {
        fetchUrl = String(url);
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Store in cache for next time
    const data = await response.arrayBuffer();
    await cache.set(url, data);
    // Return a new response with the data
    return new Response(data, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}
exports.default = ModelCache;

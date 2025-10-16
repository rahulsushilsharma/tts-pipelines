/// <reference types="@webgpu/types" />
import { chunkText, cleanTextForTTS } from "./text-cleaner.js";
export async function detectWebGPU() {
    try {
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    }
    catch {
        return false;
    }
}
// Text splitting stream to break text into chunks
export class TextSplitterStream {
    chunks;
    closed;
    constructor() {
        this.chunks = [];
        this.closed = false;
    }
    chunkText(text) {
        // Clean the text first, then chunk it
        const cleanedText = cleanTextForTTS(text);
        return chunkText(cleanedText);
    }
    push(text) {
        // Simple sentence splitting for now
        const sentences = this.chunkText(text) || [text];
        this.chunks.push(...sentences);
    }
    close() {
        this.closed = true;
    }
    async *[Symbol.asyncIterator]() {
        for (const chunk of this.chunks) {
            yield chunk;
        }
    }
}
// RawAudio class to handle audio data
export class RawAudio {
    audio;
    sampling_rate;
    constructor(audio, sampling_rate) {
        this.audio = audio;
        this.sampling_rate = sampling_rate;
    }
    get length() {
        return this.audio.length;
    }
    toBlob() {
        // Convert Float32Array to WAV blob
        const buffer = this.encodeWAV(this.audio, this.sampling_rate);
        return new Blob([buffer], { type: "audio/wav" });
    }
    encodeWAV(samples, sampleRate) {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);
        // RIFF identifier
        this.writeString(view, 0, "RIFF");
        // file length
        view.setUint32(4, 36 + samples.length * 2, true);
        // RIFF type
        this.writeString(view, 8, "WAVE");
        // format chunk identifier
        this.writeString(view, 12, "fmt ");
        // format chunk length
        view.setUint32(16, 16, true);
        // sample format (raw)
        view.setUint16(20, 1, true);
        // channel count
        view.setUint16(22, 1, true);
        // sample rate
        view.setUint32(24, sampleRate, true);
        // byte rate (sample rate * block align)
        view.setUint32(28, sampleRate * 2, true);
        // block align (channel count * bytes per sample)
        view.setUint16(32, 2, true);
        // bits per sample
        view.setUint16(34, 16, true);
        // data chunk identifier
        this.writeString(view, 36, "data");
        // data chunk length
        view.setUint32(40, samples.length * 2, true);
        this.floatTo16BitPCM(view, 44, samples);
        return buffer;
    }
    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
    floatTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        }
    }
}
export async function loadONNXRuntime() {
    const isBrowser = typeof window !== "undefined" && typeof window.document !== "undefined";
    try {
        if (isBrowser) {
            // Web environment: safe to import directly
            const ort = await import("onnxruntime-web");
            return ort;
        }
        else {
            // Node environment: prevent bundlers from touching .node bindings
            const nodeImport = new Function("return import('onnxruntime-node')");
            const ort = await nodeImport();
            return ort;
        }
    }
    catch (error) {
        const target = isBrowser ? "onnxruntime-web" : "onnxruntime-node";
        const message = [
            `❌ Failed to load ${target}.`,
            `Environment detected: ${isBrowser ? "browser" : "Node.js"}`,
            `Make sure you've installed it:`,
            `   npm install ${target}`,
            "",
            `Original error: ${error instanceof Error ? error.message : error}`,
        ].join("\n");
        throw new Error(message);
    }
}

export declare function detectWebGPU(): Promise<boolean>;
export declare class TextSplitterStream {
    chunks: string[];
    closed: boolean;
    constructor();
    chunkText(text: string): string[];
    push(text: string): void;
    close(): void;
    [Symbol.asyncIterator](): AsyncGenerator<string, void, unknown>;
}
export declare class RawAudio {
    audio: any;
    sampling_rate: any;
    constructor(audio: any, sampling_rate: any);
    get length(): any;
    toBlob(): Blob;
    encodeWAV(samples: string | any[], sampleRate: number): ArrayBuffer;
    writeString(view: DataView<ArrayBuffer>, offset: number, string: string): void;
    floatTo16BitPCM(output: DataView<ArrayBuffer>, offset: number, input: string | any[]): void;
}
export declare function loadONNXRuntime(): Promise<{
    default: typeof import("onnxruntime-web");
    registerBackend: (name: string, backend: import("onnxruntime-web").Backend, priority: number) => void;
    env: import("onnxruntime-web").Env;
    InferenceSession: import("onnxruntime-web").InferenceSessionFactory;
    Tensor: import("onnxruntime-web").TensorConstructor;
    TRACE: (deviceType: string, label: string) => void;
    TRACE_FUNC_BEGIN: (extraMsg?: string) => void;
    TRACE_FUNC_END: (extraMsg?: string) => void;
    TRACE_EVENT_BEGIN: (extraMsg?: string) => void;
    TRACE_EVENT_END: (extraMsg?: string) => void;
} | typeof import("onnxruntime-node")>;
export declare function normalizePeak(f32: Float32Array<ArrayBuffer>, target?: number): void;
export declare function trimSilence(f32: Float32Array<ArrayBuffer>, thresh?: number, minSamples?: number): Float32Array<ArrayBuffer>;
//# sourceMappingURL=utils.d.ts.map
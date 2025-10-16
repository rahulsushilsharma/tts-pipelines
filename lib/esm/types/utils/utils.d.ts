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
export declare function loadONNXRuntime(): Promise<any>;
//# sourceMappingURL=utils.d.ts.map
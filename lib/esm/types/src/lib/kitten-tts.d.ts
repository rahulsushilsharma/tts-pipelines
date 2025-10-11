import { InferenceSession } from "onnxruntime-web";
import { RawAudio } from "../utils/utils.js";
export declare class KittenTTS {
    voices: {
        id: string;
        name: string;
    }[];
    session: InferenceSession | null;
    voiceEmbeddings: {
        [key: string]: any;
    };
    wasmSession: InferenceSession | null;
    tokenizer: any;
    vocab: any;
    vocabArray: string[];
    constructor(voices: {
        id: string;
        name: string;
    }[] | undefined, session: InferenceSession | null, voiceEmbeddings: {
        [key: string]: any;
    } | undefined);
    static from_pretrained(model_path: string | number | ArrayBuffer | ArrayBufferView<ArrayBuffer> | Date | IDBValidKey[] | IDBKeyRange | Request | URL, options?: {
        device?: "webgpu" | "wasm";
    }): Promise<KittenTTS>;
    loadTokenizer(): Promise<void>;
    textToPhonemes(text: any): Promise<string[]>;
    tokenizeText(text: any): Promise<any[]>;
    stream(textStreamer: any, options?: {
        voice?: string;
        speed?: number;
    }): AsyncGenerator<{
        text: any;
        audio: RawAudio;
    }, void, unknown>;
}
//# sourceMappingURL=kitten-tts.d.ts.map
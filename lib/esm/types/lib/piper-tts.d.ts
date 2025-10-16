import { InferenceSession } from "onnxruntime-web";
import { RawAudio } from "../utils/utils.js";
export declare class PiperTTS {
    voiceConfig: any;
    session: InferenceSession | null;
    phonemeIdMap: null;
    constructor(voiceConfig: null, session: InferenceSession | null);
    static from_pretrained(modelPath: string | number | Date | ArrayBuffer | ArrayBufferView<ArrayBuffer> | IDBValidKey[] | IDBKeyRange | Request | URL, configPath: string | number | Date | ArrayBuffer | ArrayBufferView<ArrayBuffer> | IDBValidKey[] | IDBKeyRange | Request | URL): Promise<PiperTTS>;
    textToPhonemes(text: string): Promise<string[][]>;
    phonemesToIds(textPhonemes: any): any[];
    stream(textStreamer: any, options?: {
        speakerId?: number;
        lengthScale?: number;
        noiseScale?: number;
        noiseWScale?: number;
    }): AsyncGenerator<{
        text: any;
        audio: RawAudio;
    }, void, unknown>;
    getSpeakers(): {
        id: unknown;
        name: string;
        originalId: string;
    }[] | {
        id: number;
        name: string;
    }[];
}
//# sourceMappingURL=piper-tts.d.ts.map
import { InferenceSession } from "onnxruntime-web";
import { RawAudio } from "../utils/utils.js";
export declare class PiperTTS {
    voiceConfig: any;
    session: InferenceSession | null;
    phonemeIdMap: null;
    result_audio: {
        audio: RawAudio;
        text: string;
    }[];
    static modelPath: string;
    static configPath: string;
    constructor(voiceConfig: null, session: InferenceSession | null);
    static from_pretrained(modelPath?: string, configPath?: string): Promise<PiperTTS>;
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
    merge_audio(): RawAudio | null | undefined;
    close(): Promise<void>;
    getAudio(): {
        audio: RawAudio;
        text: string;
    }[];
    clearAudio(): void;
}
//# sourceMappingURL=piper-tts.d.ts.map
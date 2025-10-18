import { phonemize } from "phonemizer";
import { loadONNXRuntime, normalizePeak, RawAudio, trimSilence, } from "../utils/utils.js";
// Piper TTS class for local model
export class PiperTTS {
    voiceConfig;
    session;
    phonemeIdMap;
    result_audio = [];
    static modelPath = `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx`;
    static configPath = `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json`;
    constructor(voiceConfig, session) {
        this.voiceConfig = voiceConfig;
        this.session = session;
        this.phonemeIdMap = null;
    }
    static async from_pretrained(modelPath, configPath) {
        try {
            // Import ONNX Runtime Web and caching utility
            if (!modelPath) {
                modelPath = this.modelPath;
            }
            if (!configPath) {
                configPath = this.configPath;
            }
            const ort = await loadONNXRuntime();
            const { cachedFetch } = await import("../utils/model-cache.js");
            // Use local files in public directory with threading enabled
            ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/`;
            // Load model and config
            const [modelResponse, configResponse] = await Promise.all([
                cachedFetch(modelPath),
                cachedFetch(configPath),
            ]);
            const [modelBuffer, voiceConfig] = await Promise.all([
                modelResponse.bytes(),
                configResponse.json(),
            ]);
            // Create ONNX session with WASM execution provider
            const session = await ort.InferenceSession.create(modelBuffer, {
                executionProviders: [
                    {
                        name: "wasm",
                    },
                    "cuda",
                    "cpu",
                ],
            });
            return new PiperTTS(voiceConfig, session);
        }
        catch (error) {
            console.error("Error loading Piper model:", error);
            throw error;
        }
    }
    // Convert                                                                                                                                                           to phonemes using the phonemizer package
    async textToPhonemes(text) {
        if (this.voiceConfig.phoneme_type === "text") {
            // Text phonemes - just return normalized characters
            return [Array.from(text.normalize("NFD"))];
        }
        // Use phonemizer for espeak-style phonemes
        const voice = this.voiceConfig.espeak?.voice || "en-us";
        const phonemes = await phonemize(text, voice);
        // Handle different return types from phonemizer
        let phonemeText;
        if (typeof phonemes === "string") {
            phonemeText = phonemes;
        }
        else if (Array.isArray(phonemes)) {
            // Join the array elements - each element is a phonemized sentence
            phonemeText = phonemes.join(" ");
        }
        else if (phonemes &&
            typeof phonemes === "object" &&
            !Array.isArray(phonemes)) {
            // If it's an object, try to extract text or phonemes property
            if ("text" in phonemes) {
                phonemeText = phonemes.text;
            }
            else if ("phonemes" in phonemes) {
                phonemeText = phonemes.phonemes;
            }
            else {
                phonemeText = String(phonemes);
            }
        }
        else {
            console.warn("Unexpected phonemes format:", phonemes);
            phonemeText = String(phonemes || text);
        }
        // Split into sentences and convert to character arrays
        const sentences = phonemeText
            .split(/[.!?]+/)
            .filter((s) => s.trim());
        return sentences.map((sentence) => Array.from(sentence.trim().normalize("NFD")));
    }
    // Convert phonemes to IDs using the phoneme ID map
    phonemesToIds(textPhonemes) {
        if (!this.voiceConfig || !this.voiceConfig.phoneme_id_map) {
            throw new Error("Phoneme ID map not available");
        }
        const idMap = this.voiceConfig.phoneme_id_map;
        const BOS = "^";
        const EOS = "$";
        const PAD = "_";
        let phonemeIds = [];
        for (let sentencePhonemes of textPhonemes) {
            phonemeIds.push(idMap[BOS]);
            phonemeIds.push(idMap[PAD]);
            for (let phoneme of sentencePhonemes) {
                if (phoneme in idMap) {
                    phonemeIds.push(idMap[phoneme]);
                    phonemeIds.push(idMap[PAD]);
                }
            }
            phonemeIds.push(idMap[EOS]);
        }
        return phonemeIds;
    }
    async *stream(textStreamer, options = {
        speakerId: 0,
        lengthScale: 1.0,
        noiseScale: 0.667,
        noiseWScale: 0.8,
    }) {
        const { speakerId = 0, lengthScale = 1.0, noiseScale = 0.667, noiseWScale = 0.8, } = options;
        // Process the text stream
        for await (const text of textStreamer) {
            if (text.trim()) {
                try {
                    if (this.session && this.voiceConfig) {
                        // Convert text to phonemes then to IDs
                        const textPhonemes = await this.textToPhonemes(text);
                        const phonemeIds = this.phonemesToIds(textPhonemes);
                        // Prepare tensors for Piper model
                        const ort = await loadONNXRuntime();
                        const inputs = {
                            input: new ort.Tensor("int64", new BigInt64Array(phonemeIds.map((id) => BigInt(id))), [1, phonemeIds.length]),
                            input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(phonemeIds.length)]), [1]),
                            scales: new ort.Tensor("float32", Float32Array.from([noiseScale, lengthScale, noiseWScale]), [3]),
                        };
                        // Add speaker ID for multi-speaker models
                        if (this.voiceConfig.num_speakers > 1) {
                            inputs["sid"] = new ort.Tensor("int64", BigInt64Array.from([BigInt(speakerId)]), [1]);
                        }
                        const results = await this.session.run(inputs);
                        // Extract audio data
                        const audioOutput = results.output;
                        const audioData = audioOutput.data;
                        // Use the sample rate from config
                        const sampleRate = this.voiceConfig.audio.sample_rate;
                        // Clean up audio data
                        const finalAudioData = new Float32Array(Array.from(audioData));
                        const result = {
                            text,
                            audio: new RawAudio(finalAudioData, sampleRate),
                        };
                        this.result_audio.push(result);
                        yield result;
                    }
                }
                catch (error) {
                    console.error("Error generating audio:", error);
                    // Yield silence in case of error
                    const result = {
                        text,
                        audio: new RawAudio(new Float32Array(22050), 22050),
                    };
                    this.result_audio.push(result);
                    yield result;
                }
            }
        }
    }
    // Get available speakers for multi-speaker models
    getSpeakers() {
        if (!this.voiceConfig || this.voiceConfig.num_speakers <= 1) {
            return [{ id: 0, name: "Voice 1" }];
        }
        const speakerIdMap = this.voiceConfig.speaker_id_map || {};
        return Object.entries(speakerIdMap)
            .sort(([, a], [, b]) => Number(a) - Number(b)) // Sort by speaker ID (0, 1, 2, ...)
            .map(([originalId, id]) => ({
            id,
            name: `Voice ${Number(id) + 1}`,
            originalId,
        }));
    }
    merge_audio() {
        let audio = null;
        if (this.result_audio.length > 0) {
            try {
                const originalSamplingRate = this.result_audio[0].audio.sampling_rate;
                const length = this.result_audio.reduce((sum, chunk) => sum + chunk.audio.length, 0);
                let waveform = new Float32Array(length);
                let offset = 0;
                for (const { audio } of this.result_audio) {
                    waveform.set(audio.audio, offset);
                    offset += audio.length;
                }
                // Normalize peaks & trim silence
                normalizePeak(waveform, 0.9);
                waveform = trimSilence(waveform, 0.002, Math.floor(originalSamplingRate * 0.02)); // 20ms padding
                // Create a new merged RawAudio with the original sample rate
                audio = new RawAudio(waveform, originalSamplingRate);
                return audio;
            }
            catch (error) {
                console.error("Error processing audio chunks:", error);
                return null;
            }
        }
    }
    async close() {
        if (this.session) {
            await this.session.release();
            this.session = null;
        }
    }
    getAudio() {
        return this.result_audio;
    }
}

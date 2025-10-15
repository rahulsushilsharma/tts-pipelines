/* eslint-disable no-undef */

import { InferenceSession } from "onnxruntime-web";
import { RawAudio } from "../utils/utils.js";

// KittenTTS class for local model

export class KittenTTS {
  voices: { id: string; name: string }[];
  session: InferenceSession | null;
  voiceEmbeddings: { [key: string]: any };
  wasmSession: InferenceSession | null;
  tokenizer: any;
  vocab: any;
  vocabArray: string[];

  constructor(
    voices: { id: string; name: string }[] | undefined,
    session: InferenceSession | null,
    voiceEmbeddings: { [key: string]: any } | undefined
  ) {
    this.voices = voices || [];
    this.session = session;
    this.voiceEmbeddings = voiceEmbeddings || {};
    this.wasmSession = null; // Fallback WASM session\
    this.vocab = {};
    this.vocabArray = [];
  }

  static async from_pretrained(
    model_path:
      | string
      | number
      | ArrayBuffer
      | ArrayBufferView<ArrayBuffer>
      | Date
      | IDBValidKey[]
      | IDBKeyRange
      | Request
      | URL,
    options: {
      device?: "webgpu" | "wasm";
    } = {}
  ) {
    try {
      alert("Loading local model...");

      // Import ONNX Runtime Web and caching utility
      const ort = await import("onnxruntime-web");
      const { cachedFetch } = await import("../utils/model-cache.js");

      // Use local files in public directory with threading enabled

      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/`;
      // Load model using cached fetch
      const modelResponse = await cachedFetch(model_path);
      const modelBuffer = await modelResponse.bytes();

      // Try WebGPU with better configuration, fallback to WASM
      let session: InferenceSession | null = null;
      try {
        if (options.device === "webgpu") {
          // Try WebGPU with specific settings for better compatibility
          session = await ort.InferenceSession.create(modelBuffer, {
            executionProviders: [
              {
                name: "webgpu",
                preferredLayout: "NCHW",
                // Try to improve precision for better audio quality
              },
              "wasm", // Keep WASM as fallback
            ],
            // Global session options that might help with precision
            enableProfiling: true,
          });
        } else {
          throw new Error("Using WASM as requested");
        }
      } catch (webgpuError) {
        // Fallback to WASM with explicit configuration

        session = await ort.InferenceSession.create(modelBuffer, {
          executionProviders: [
            {
              name: "wasm",
            },
          ],
        });
      }

      // Load voices from the local voices.json file (also cached)
      const voicesResponse = await cachedFetch(
        `https://raw.githubusercontent.com/rahulsushilsharma/tts-pipelines/refs/heads/main/public/tts-model/voices_kitten.json`
      );
      const voicesData = await voicesResponse.json();

      // Transform the voices data into the format we need
      const voices = Object.keys(voicesData).map((key) => ({
        id: key,
        name: key
          .replace("expr-", "")
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase())
          .replace("M", "Male")
          .replace("F", "Female"),
      }));

      return new KittenTTS(voices, session, voicesData);
    } catch (error) {
      console.error("Error loading local model:", error);
      // Fallback to default voices without model
      return new KittenTTS([], null, {});
    }
  }

  // Load the tokenizer
  async loadTokenizer() {
    if (!this.tokenizer) {
      try {
        const { cachedFetch } = await import("../utils/model-cache.js");
        const response = await cachedFetch(
          `https://raw.githubusercontent.com/rahulsushilsharma/tts-pipelines/refs/heads/main/public/tts-model/tokenizer.json`
        );
        const tokenizerData = await response.json();

        // Extract the actual vocabulary from the tokenizer
        this.vocab = tokenizerData.model.vocab;
        this.vocabArray = [];

        // Create reverse mapping
        for (const [char, id] of Object.entries(this.vocab)) {
          this.vocabArray[id as number] = char;
        }

        this.tokenizer = tokenizerData;
      } catch (error) {
        console.error("Error loading tokenizer:", error);
        this.vocab = {};
        this.vocabArray = [];
      }
    }
  }

  // Convert text to phonemes using the phonemizer package
  async textToPhonemes(text: any) {
    // Import the phonemizer package
    const { phonemize } = await import("phonemizer");
    const phonemes = await phonemize(text, "en-us");
    console.log("Phonemes:", phonemes);
    return phonemes;
  }

  // Tokenize text using the loaded tokenizer
  async tokenizeText(text: any) {
    await this.loadTokenizer();

    const phonemes = await this.textToPhonemes(text);
    const tokensWithBoundaries = `$${phonemes}$`;

    // Convert to token IDs
    const tokens = tokensWithBoundaries.split("").map((char) => {
      const tokenId = this.vocab[char];
      if (tokenId === undefined) {
        console.warn(`Unknown character: "${char}", using $ token`);
        return 0; // Use $ token for unknown chars
      }
      return tokenId;
    });

    return tokens;
  }

  async *stream(
    textStreamer: any,
    options: { voice?: string; speed?: number } = {}
  ) {
    const { voice = "expr-voice-2-m", speed = 1.0 } = options;

    // Process the text stream
    for await (const text of textStreamer) {
      if (text.trim()) {
        try {
          if (this.session && this.voiceEmbeddings[voice]) {
            try {
              const tokenIds = await this.tokenizeText(text);
              const inputIds = new BigInt64Array(
                tokenIds.map((id) => BigInt(id))
              );
              const speakerEmbedding = new Float32Array(
                this.voiceEmbeddings[voice][0]
              );
              const ort = await import("onnxruntime-web");

              const inputs = {
                input_ids: new ort.Tensor("int64", inputIds, [
                  1,
                  inputIds.length,
                ]),
                style: new ort.Tensor("float32", speakerEmbedding, [
                  1,
                  speakerEmbedding.length,
                ]),
                speed: new ort.Tensor("float32", new Float32Array([speed]), [
                  1,
                ]),
              };

              let results = await this.session.run(inputs);

              // Extract audio data - we know it's called 'waveform'
              let audioOutput = results.waveform;
              let audioData = audioOutput.data;

              // Check if WebGPU produced NaN values and fallback to WASM
              if (audioData.length > 0 && isNaN(Number(audioData[0]))) {
                // Create WASM session if we don't have one
                if (!this.wasmSession) {
                  const ort = await import("onnxruntime-web");
                  this.wasmSession = await ort.InferenceSession.create(
                    `https://huggingface.co/onnx-community/kitten-tts-nano-0.1-ONNX/resolve/main/onnx/model_quantized.onnx`,
                    {
                      executionProviders: ["wasm"],
                    }
                  );
                }

                // Retry inference with WASM
                if (this.wasmSession == null)
                  throw new Error("WASM session not created");
                results = await this.wasmSession.run(inputs);
                audioOutput = results.waveform;
                audioData = audioOutput.data;
              }

              // Use the correct sample rate based on our calculation
              const sampleRate = 24000; // Model generates 24kHz audio

              // Find min/max without causing stack overflow
              let min = audioData[0],
                max = audioData[0];
              for (let i = 1; i < audioData.length; i++) {
                if (audioData[i] < min) min = audioData[i];
                if (audioData[i] > max) max = audioData[i];
              }

              // Apply speed adjustment
              let finalAudioData = new Float32Array(
                Array.from(audioData as ArrayLike<number>)
              );
              if (speed !== 1.0) {
                // Simple time-stretching by resampling
                const newLength = Math.floor(audioData.length / speed);
                finalAudioData = new Float32Array(newLength);
                for (let i = 0; i < newLength; i++) {
                  const srcIndex = Math.floor(i * speed);
                  finalAudioData[i] = Number(
                    audioData[Math.min(srcIndex, audioData.length - 1)]
                  );
                }
              }

              // Clean up NaN values and normalize
              let hasNaN = false;
              let maxAmplitude = 0;
              for (let i = 0; i < finalAudioData.length; i++) {
                if (isNaN(finalAudioData[i])) {
                  finalAudioData[i] = 0; // Replace NaN with silence
                  hasNaN = true;
                } else {
                  maxAmplitude = Math.max(
                    maxAmplitude,
                    Math.abs(finalAudioData[i])
                  );
                }
              }

              // Normalize audio if it's too quiet
              if (maxAmplitude > 0 && maxAmplitude < 0.1) {
                const normalizationFactor = 0.5 / maxAmplitude;

                for (let i = 0; i < finalAudioData.length; i++) {
                  finalAudioData[i] *= normalizationFactor;
                }
              }

              yield {
                text,
                audio: new RawAudio(finalAudioData, sampleRate),
              };
            } catch (modelError) {
              console.error("Model inference error:", modelError);
              if (
                typeof modelError === "object" &&
                modelError !== null &&
                "message" in modelError
              ) {
                console.error(
                  "Error details:",
                  (modelError as { message?: string }).message
                );
              }
            }
          }
        } catch (error) {
          console.error("Error generating audio:", error);
          // Yield silence in case of error
          yield {
            text,
            audio: new RawAudio(new Float32Array(22050), 22050),
          };
        }
      }
    }
  }
}

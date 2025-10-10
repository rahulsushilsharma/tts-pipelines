import { KittenTTS, TextSplitterStream } from "./lib/kitten-tts.js";
import { detectWebGPU } from "./utils/utils.js";

let tts = null;
let device = "wasm";

console.log("Worker started, ");
// Initialize the model
async function initializeModel(useWebGPU = false) {
  try {
    // Device detection
    const webGPUSupported = await detectWebGPU();
    device = useWebGPU && webGPUSupported ? "webgpu" : "wasm";

    console.log({ status: "device", device });

    // Load the model
    const model_path = `../public/tts-model/model_quantized.onnx`;
    tts = await KittenTTS.from_pretrained(model_path, {
      dtype: "q8",
      device,
    });

    console.log({ status: "ready", voices: tts.voices, device });
  } catch (e) {
    console.error("Error loading model:", e);
    console.log({ status: "error", data: e.message });
  }
}

// Listen for messages from the main thread
async function main(e) {
  const { type, useWebGPU, text, voice, speed, sampleRate = 24000 } = e.data;

  console.log({ type, useWebGPU, text, voice, speed, sampleRate });
  // Handle initialization
  if (type === "init") {
    await initializeModel(useWebGPU);
    return;
  }

  // Handle TTS generation
  if (!tts) {
    console.log({ status: "error", data: "Model not initialized" });
    return;
  }

  const streamer = new TextSplitterStream();

  streamer.push(text);
  streamer.close(); // Indicate we won't add more text

  const stream = tts.stream(streamer, { voice, speed });
  const chunks = [];

  console.log({ status: "streaming" });
  try {
    for await (const { text, audio } of stream) {
      console.log({
        status: "stream",
        chunk: {
          audio: audio.toBlob(),
          text,
        },
      });
      chunks.push(audio);
    }
  } catch (error) {
    console.error("Error during streaming:", error);
    console.log({ status: "error", data: error.message });
    return;
  }

  // Merge chunks
  let audio;
  if (chunks.length > 0) {
    try {
      const originalSamplingRate = chunks[0].sampling_rate;
      const length = chunks.reduce((sum, chunk) => sum + chunk.audio.length, 0);
      let waveform = new Float32Array(length);
      let offset = 0;
      for (const { audio } of chunks) {
        waveform.set(audio, offset);
        offset += audio.length;
      }

      // Normalize peaks & trim silence
      normalizePeak(waveform, 0.9);
      waveform = trimSilence(
        waveform,
        0.002,
        Math.floor(originalSamplingRate * 0.02)
      ); // 20ms padding

      // Resample if needed
      if (sampleRate !== originalSamplingRate) {
        // Apply anti-aliasing filter for downsampling
        if (sampleRate < originalSamplingRate) {
          waveform = antiAliasFilter(
            waveform,
            originalSamplingRate,
            sampleRate
          );
        }

        waveform = resampleLinear(waveform, originalSamplingRate, sampleRate);
      }

      // Create a new merged RawAudio with the target sample rate
      // @ts-expect-error - So that we don't need to import RawAudio
      audio = new chunks[0].constructor(waveform, sampleRate);
    } catch (error) {
      console.error("Error processing audio chunks:", error);
      console.log({ status: "error", data: error.message });
      return;
    }
  }

  console.log({ status: "complete", audio: audio?.toBlob() });
  // play the audio
  document.getElementById("audio").src = URL.createObjectURL(audio.toBlob());
  const done = document.createElement("div");
  done.innerHTML = "Done";
  document.querySelector("body").appendChild(done);
}

function normalizePeak(f32, target = 0.9) {
  if (!f32?.length) return;
  let max = 1e-9;
  for (let i = 0; i < f32.length; i++) max = Math.max(max, Math.abs(f32[i]));
  const g = Math.min(4, target / max);
  if (g < 1) {
    for (let i = 0; i < f32.length; i++) f32[i] *= g;
  }
}

function trimSilence(f32, thresh = 0.002, minSamples = 480) {
  let s = 0,
    e = f32.length - 1;
  while (s < e && Math.abs(f32[s]) < thresh) s++;
  while (e > s && Math.abs(f32[e]) < thresh) e--;
  s = Math.max(0, s - minSamples);
  e = Math.min(f32.length, e + minSamples);
  return f32.slice(s, e);
}

function antiAliasFilter(input, inRate, outRate) {
  // Simple low-pass filter to prevent aliasing during downsampling
  const cutoff = Math.min(outRate / 2, inRate / 2) * 0.9; // 90% of Nyquist frequency
  const nyquist = inRate / 2;
  const normalizedCutoff = cutoff / nyquist;

  // Simple IIR low-pass filter (Butterworth-like)
  const a = Math.exp(-2 * Math.PI * normalizedCutoff);
  const output = new Float32Array(input.length);

  output[0] = input[0] * (1 - a);
  for (let i = 1; i < input.length; i++) {
    output[i] = input[i] * (1 - a) + output[i - 1] * a;
  }

  return output;
}

function resampleLinear(input, inRate, outRate) {
  if (inRate === outRate) return input;
  const ratio = outRate / inRate;
  const outLen = Math.floor(input.length * ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i / ratio;
    const i0 = Math.floor(pos);
    const i1 = Math.min(input.length - 1, i0 + 1);
    const t = pos - i0;
    out[i] = input[i0] * (1 - t) + input[i1] * t;
  }
  return out;
}

// main({
//   data:{
//     text:"hello world",
//     sampleRate: 22050
//   }
// })

async function main_() {
  await initializeModel(true);

  await main({
    data: {
      text: "Kokoro is a frontier TTS model for its size of 82 million parameters",
      useWebGPU: true,
      voice: "expr-voice-2-m",
      speed: 1.0,
    },
  });
}

main_();

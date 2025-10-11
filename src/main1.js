import { PiperTTS } from "./lib/piper-tts.js";
import { TextSplitterStream } from "./utils/utils.js";
let tts = null;

// Initialize the model
async function initializeModel() {
  try {
    // Load the Piper model and config
    const modelPath = `../public/tts-model/en_US-libritts_r-medium.onnx`;
    const configPath = `../public/tts-model/en_US-libritts_r-medium.onnx.json`;

    tts = await PiperTTS.from_pretrained(modelPath, configPath);

    // Get available speakers
    const speakers = tts.getSpeakers();

    console.log({ status: "ready", voices: speakers });
  } catch (e) {
    console.error("Error loading model:", e);
    console.log({ status: "error", data: e.message });
  }
}

// Handle voice preview
async function handlePreview(text, voice, speed) {
  try {
    const streamer = new TextSplitterStream();
    streamer.push(text);
    streamer.close();

    const speakerId = typeof voice === "number" ? voice : parseInt(voice) || 0;
    const lengthScale = 1.0 / (speed || 1.0);

    const stream = tts.stream(streamer, {
      speakerId,
      lengthScale,
    });

    // Get just the first chunk for preview
    for await (const { audio } of stream) {
      // Create and play preview audio
      const audioBlob = audio.toBlob();
      self.postMessage({ status: "preview", audio: audioBlob });
      break; // Only preview the first chunk
    }
  } catch (error) {
    console.error("Error generating preview:", error);
  }
}

// Listen for messages from the main thread
async function main(e) {
  const { type, text, voice, speed } = e.data;

  // Handle initialization
  if (type === "init") {
    await initializeModel();
    return;
  }

  // Handle TTS generation
  if (!tts) {
    console.log({ status: "error", data: "Model not initialized" });
    return;
  }

  // Handle voice preview
  if (type === "preview") {
    await handlePreview(text, voice, speed);
    return;
  }

  const streamer = new TextSplitterStream();

  streamer.push(text);
  streamer.close(); // Indicate we won't add more text

  // Convert voice from voice ID to speaker ID
  const speakerId = typeof voice === "number" ? voice : parseInt(voice) || 0;

  // Convert speed to lengthScale (inverse relationship: higher speed = lower lengthScale)
  const lengthScale = 1.0 / (speed || 1.0);

  const stream = tts.stream(streamer, {
    speakerId,
    lengthScale,
  });
  const chunks = [];

  try {
    for await (const { text, audio } of stream) {
      self.postMessage({
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

      // Create a new merged RawAudio with the original sample rate
      // @ts-expect-error - So that we don't need to import RawAudio
      audio = new chunks[0].constructor(waveform, originalSamplingRate);
    } catch (error) {
      console.error("Error processing audio chunks:", error);
      console.log({ status: "error", data: error.message });
      return;
    }
  }

  console.log({ status: "complete", audio: audio?.toBlob() });
  // play audio
  const audioBlob = audio.toBlob();
  const audioUrl = URL.createObjectURL(audioBlob);
  const audioElement = document.getElementById("audio");
  audioElement.src = audioUrl;
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

// Note: Initialization now handled via init message from UI

async function main_() {
  await initializeModel(true);

  await main({
    data: {
      text: "Kokoro is a frontier TTS model for its size of 82 million parameters",

      voice: 0,
      speed: 1.0,
    },
  });
}

main_();

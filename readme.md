# tts-pipelines

A simple and powerfull tts pipelines working totally local in browser or in node environment using [ONNX Runtime](https://github.com/microsoft/onnxruntime) and [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API).

The pipeline uses Kitten TTS and Piper TTS (very powerfull and lightweight tts models that can even be used in the browser) under the hood to generate audio from text.

## Installation

> The package requires onnxruntime to be installed.if using on the web use the [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) package and if using on node use the [onnxruntime-node](https://www.npmjs.com/package/onnxruntime-node) package.

Current stable release (`0.2`)

```sh
npm i tts-pipelines
```

## Example usage (node 18.x and higher)

```js
import { PiperTTS, saveAudio, TextSplitterStream } from "tts-pipelines";

const tts = await PiperTTS.from_pretrained();
// or KittenTTS:
// import { KittenTTS, saveAudio, TextSplitterStream } from "tts-pipelines";
// const tts = await KittenTTS.from_pretrained();

const streamer = new TextSplitterStream();

streamer.push("hello world");
streamer.close(); // Indicate we won't add more text

const stream = tts.stream(streamer);
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
}

const audio = await tts.merge_audio();
console.log({ status: "complete", audio: audio.toBlob() });
await saveAudio(audio.toBlob(), "./speech.wav");
```

> Note: Supported in node 18.x and higher.

> Note: In case the package stops working please report it and update the package to latest if available.

## Documentations

Full API documentations of both classes can be found here

## Contributions

- If you happen to see missing feature or a bug, feel free to open an [issue](https://github.com/rahulsushilsharma/tts-pipelines/issues).
- Pull requests are welcomed too!

## License

[MIT](LICENSE.md)

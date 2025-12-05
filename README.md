# DeepFilterNet3 Noise Filter for LiveKit

AI-powered noise suppression for real-time audio processing with LiveKit.

Based on the [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) paper and implementation by Rikorose.

## Installation

```bash
npm install deepfilternet3-noise-filter
```

## Usage

### Basic Audio Processing

```javascript
import { DeepFilterNet3Processor } from 'deepfilternet3-noise-filter';

// Create audio context
const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

// Initialize processor
const proc = new DeepFilterNet3Processor({
  sampleRate: 48000,
  noiseReductionLevel: 0
});

await proc.initialize();

// Create audio worklet node
const node = await proc.createAudioWorkletNode(ctx);

// Connect your audio stream
const src = ctx.createMediaStreamSource(stream);
const dst = ctx.createMediaStreamDestination();
src.connect(node).connect(dst);

// Adjust noise reduction level (0-100)
proc.setSuppressionLevel(50);
```

### React Example

```javascript
import React, { useRef, useEffect } from 'react';
import { DeepFilterNet3Processor } from 'deepfilternet3-noise-filter';

function AudioProcessor({ stream, level = 50 }) {
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const nodeRef = useRef(null);

  useEffect(() => {
    const setupAudio = async () => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      ctxRef.current = ctx;

      const proc = new DeepFilterNet3Processor({
        sampleRate: 48000,
        noiseReductionLevel: 0
      });

      await proc.initialize();
      procRef.current = proc;
      
      const node = await proc.createAudioWorkletNode(ctx);
      nodeRef.current = node;

      const src = ctx.createMediaStreamSource(stream);
      const dst = ctx.createMediaStreamDestination();
      src.connect(node).connect(dst);
      proc.setSuppressionLevel(level);
    };

    if (stream) {
      setupAudio();
    }

    return () => {
      if (procRef.current) {
        procRef.current.destroy();
      }
    };
  }, [stream, level]);

  return null; // This component only handles audio processing
}
```

**No configuration needed** - WebAssembly files and worker code are automatically handled!

## Bundler Compatibility

This package works out-of-the-box with all modern bundlers:

- **Webpack** (4, 5+)
- **Vite**
- **Rollup**
- **esbuild**
- **Parcel**

Worker and worklet files are automatically inlined as blob URLs, so **no webpack configuration or copy plugins are required**. Just `npm install` and use!

### LiveKit Integration

```javascript
import { DeepFilterNoiseFilterProcessor } from 'deepfilternet3-noise-filter';

// Create the processor
const filter = new DeepFilterNoiseFilterProcessor({
  sampleRate: 48000,
  noiseReductionLevel: 80,
  enabled: true,
  assetConfig: {
    cdnUrl: 'https://cdn.laptrinhai.id.vn/deepfilternet3' // Optional: use custom CDN
  }
});

// Use with LiveKit
await audioTrack.setProcessor(filter);
await room.localParticipant.publishTrack(audioTrack);

// Control noise reduction
filter.setSuppressionLevel(60);
filter.setEnabled(false); // Disable temporarily
```

For a complete React example, see: [DeepFilterNet3 React Example](https://github.com/mezonai/DeepFilterNet3-React-Example)

### Build

```bash
yarn
yarn build
```

Outputs:
- `dist/`

### Model source

This package is based on [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) by Rikorose.

**Original Paper:**
- Schröter, H., Rosenkranz, T., Escalante-B., A.N., & Maier, A. (2022). DeepFilterNet: A Low Complexity Speech Enhancement Framework for Full-Band Audio based on Deep Filtering. *ICASSP 2022 - 2022 IEEE International Conference on Acoustics, Speech and Signal Processing (ICASSP)*, 7407-7411.
- [Paper on arXiv](https://arxiv.org/abs/2110.05588)

The included model archive `DeepFilterNet3_onnx.tar.gz` is from:
- [DeepFilterNet3_onnx.tar.gz](https://github.com/Rikorose/DeepFilterNet/blob/main/models/DeepFilterNet3_onnx.tar.gz)

Please refer to the upstream repository for licensing and updates.

### Building assets from source (contributors)

To regenerate the WASM package and copy resources from the upstream project:

```bash
git clone https://github.com/Rikorose/DeepFilterNet/
cd DeepFilterNet
bash scripts/build_wasm_package.sh

# Copy WASM glue into this repo's pkg/
cp -r libdf/pkg ../livekit-deepfilternet3-noise-filter/df3

cd ../livekit-deepfilternet3-noise-filter
```

Notes:
- Ensure the destination paths match this repo's layout (`df3`).
- After copying, run `yarn build`.


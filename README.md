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
import { DeepFilterNet3Core } from 'deepfilternet3-noise-filter';

// Create audio context
const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

// Initialize processor
const proc = new DeepFilterNet3Core({
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
import { DeepFilterNet3Core } from 'deepfilternet3-noise-filter';

function AudioProcessor({ stream, level = 50 }) {
  const ctxRef = useRef(null);
  const procRef = useRef(null);
  const nodeRef = useRef(null);

  useEffect(() => {
    const setupAudio = async () => {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      ctxRef.current = ctx;

      const proc = new DeepFilterNet3Core({
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
    cdnUrl: 'https://cdn.mezon.ai/AI/models/datas/noise_suppression/deepfilternet3' // Optional: use custom CDN
  }
});

// Use with LiveKit
await audioTrack.setProcessor(filter);
await room.localParticipant.publishTrack(audioTrack);

// Control noise reduction
filter.setSuppressionLevel(60);
filter.setEnabled(false); // Disable temporarily
```

For a complete React example, see: [DeepFilterNet3 React Example](https://github.com/phuvinh010701/DeepFilterNet3-React-Example)

### Custom CDN Configuration

By default, the package loads WASM and model files from the bundled assets. You can optionally configure a custom CDN:

```javascript
const filter = new DeepFilterNoiseFilterProcessor({
  sampleRate: 48000,
  noiseReductionLevel: 80,
  assetConfig: {
    cdnUrl: 'https://your-cdn-url.com/path/to/assets'
  }
});
```

#### Version-Specific Asset Paths

Different versions use different asset path structures:

**Version <= 1.1.2:**
- Assets are loaded directly from the base path
- WASM: `{cdnUrl}/pkg/df_bg.wasm`
- Model: `{cdnUrl}/models/DeepFilterNet3_onnx.tar.gz`

**Version >= 1.2.0:**
- Assets are loaded from a `v2/` subdirectory (automatically added)
- WASM: `{cdnUrl}/v2/pkg/df_bg.wasm`
- Model: `{cdnUrl}/v2/models/DeepFilterNet3_onnx.tar.gz`
- Built with SIMD optimizations for ~20-30% better performance

**Note:** The `v2/` prefix is added automatically by the package for version >= 1.2.0, so you don't need to include it in your `cdnUrl` configuration.

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

### Building WASM from source (contributors)

#### WASM Build Configuration

The WASM module is built with optimized settings in `libDF/Cargo.toml`:

**Rust Compiler Settings** (`[profile.release]`):
```toml
opt-level = 3          # Maximum optimization for performance
lto = "thin"           # Thin Link-Time Optimization
codegen-units = 1      # Single codegen unit for better optimization
panic = "abort"        # Smaller binary size
```

**WASM Optimizer Settings** (`[package.metadata.wasm-pack.profile.release]`):
```toml
wasm-opt = [
    "-O4",                                  # Highest optimization level
    "--enable-simd",                        # Enable simd
    "--enable-bulk-memory",                 # Enable bulk memory operations
    "--enable-nontrapping-float-to-int"     # Enable non-trapping float-to-int conversions
]
```

#### Build Steps

To regenerate the WASM package and copy resources from the upstream project:

```bash
# Clone the DeepFilterNet repository
git clone https://github.com/Rikorose/DeepFilterNet/
cd DeepFilterNet/libDF

# Configure Cargo.toml with the optimization settings above
# Then build the WASM package with target features
RUSTFLAGS="-C target-feature=+simd128,+bulk-memory,+nontrapping-fptoint,+mutable-globals" \
  wasm-pack build --target web --release --features wasm

# Copy WASM files to this repo
cd ..
cp -r libDF/pkg ../mezon-noise-suppression/df3

cd ../mezon-noise-suppression
yarn build
```

**Build Notes:**
- **RUSTFLAGS target features:**
  - `+simd128`: Enable SIMD 128-bit operations for vectorized processing
  - `+bulk-memory`: Enable efficient bulk memory operations (memcpy, memset)
  - `+nontrapping-fptoint`: Enable non-trapping float-to-int conversions
  - `+mutable-globals`: Enable mutable global variables
- **Version <= 1.1.2**: Built without advanced WebAssembly features
- **Version >= 1.2.0**: Built with full WebAssembly feature set for optimal performance
- Ensure `wasm-pack` is installed: `cargo install wasm-pack`
- Browser requirements: Chrome 91+, Firefox 89+, Safari 16.4+ (for SIMD support)

## License

This project is dual-licensed under either:

- **Apache License, Version 2.0** ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- **MIT License** ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

This licensing follows the upstream [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) project by Hendrik Schröter, which uses the same dual-license approach. The DeepFilterNet WASM binaries and models included in this package are governed by the same licenses.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in the work by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.

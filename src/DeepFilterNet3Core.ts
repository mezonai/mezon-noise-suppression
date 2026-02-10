import { AssetLoader, getAssetLoader } from './asset-loader/AssetLoader';
import { createWorkletModule } from './utils/workerUtils';
import type { ProcessorAssets, DeepFilterNet3ProcessorConfig } from './interfaces';
import { WorkletMessageTypes } from './constants';
// @ts-ignore - Worklet code imported as string via rollup
import workletCode from './worklet/DeepFilterWorklet.ts?worklet-code';

export type { DeepFilterNet3ProcessorConfig };

export class DeepFilterNet3Core {
  private assetLoader: AssetLoader;
  private assets: ProcessorAssets | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;
  private bypassEnabled = false;
  private config: DeepFilterNet3ProcessorConfig;

  constructor(config: DeepFilterNet3ProcessorConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 48000,
      noiseReductionLevel: config.noiseReductionLevel ?? 50,
      assetConfig: config.assetConfig
    };
    this.assetLoader = getAssetLoader(config.assetConfig);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Fetch and compile WASM on main thread
    const assetUrls = this.assetLoader.getAssetUrls();
    const [wasmBytes, modelBytes] = await Promise.all([
      this.assetLoader.fetchAsset(assetUrls.wasm),
      this.assetLoader.fetchAsset(assetUrls.model)
    ]);

    // Compile WASM module
    const wasmModule = await WebAssembly.compile(wasmBytes);

    this.assets = { wasmModule, modelBytes };
    this.isInitialized = true;
  }

  async createAudioWorkletNode(audioContext: AudioContext): Promise<AudioWorkletNode> {
    this.ensureInitialized();

    if (!this.assets) {
      throw new Error('Assets not loaded');
    }

    await createWorkletModule(audioContext, workletCode);

    this.workletNode = new AudioWorkletNode(audioContext, 'deepfilter-audio-processor', {
      processorOptions: {
        wasmModule: this.assets.wasmModule,
        modelBytes: this.assets.modelBytes,
        suppressionLevel: this.config.noiseReductionLevel
      }
    });

    return this.workletNode;
  }

  setSuppressionLevel(level: number): void {
    if (!this.workletNode || typeof level !== 'number' || isNaN(level)) return;

    const clampedLevel = Math.max(0, Math.min(100, Math.floor(level)));
    this.workletNode.port.postMessage({
      type: WorkletMessageTypes.SET_SUPPRESSION_LEVEL,
      value: clampedLevel
    });
  }

  destroy(): void {
    if (!this.isInitialized) return;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    this.assets = null;
    this.isInitialized = false;
  }

  isReady(): boolean {
    return this.isInitialized && this.workletNode !== null;
  }

  setNoiseSuppressionEnabled(enabled: boolean): void {
    if (!this.workletNode) return;

    this.bypassEnabled = !enabled;

    this.workletNode.port.postMessage({
      type: WorkletMessageTypes.SET_BYPASS,
      value: !enabled
    });
  }

  isNoiseSuppressionEnabled(): boolean {
    return !this.bypassEnabled;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Processor not initialized. Call initialize() first.');
    }
  }
}

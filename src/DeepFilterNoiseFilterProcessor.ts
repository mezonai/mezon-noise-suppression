import { DeepFilterNet3Processor } from './DeepFilterNet3Processor';
import type { TrackProcessor, AudioProcessorOptions, Track } from 'livekit-client';
import type { DeepFilterNoiseFilterOptions } from './interfaces';

export type { DeepFilterNoiseFilterOptions };

export class DeepFilterNoiseFilterProcessor implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions> {
  name = 'deepfilternet3-noise-filter';
  processedTrack?: MediaStreamTrack;
  audioContext: AudioContext | null = null;
  sourceNode: MediaStreamAudioSourceNode | null = null;
  workletNode: AudioWorkletNode | null = null;
  destination: MediaStreamAudioDestinationNode | null = null;
  processor: DeepFilterNet3Processor;
  enabled = true;
  originalTrack?: MediaStreamTrack;

  constructor(options: DeepFilterNoiseFilterOptions = {}) {
    const cfg = {
      sampleRate: options.sampleRate ?? 48000,
      noiseReductionLevel: options.noiseReductionLevel ?? 80,
      assetConfig: options.assetConfig
    };

    this.enabled = options.enabled ?? true;
    this.processor = new DeepFilterNet3Processor(cfg);
  }

  static isSupported(): boolean {
    return typeof AudioContext !== 'undefined' && typeof WebAssembly !== 'undefined';
  }

  init = async (opts: { track?: MediaStreamTrack; mediaStreamTrack?: MediaStreamTrack }): Promise<void> => {
    const track = opts.track ?? opts.mediaStreamTrack;
    if (!track) {
      throw new Error('DeepFilterNoiseFilterProcessor.init: missing MediaStreamTrack');
    }
    this.originalTrack = track;
    await this.ensureGraph();
  };

  restart = async (opts: { track?: MediaStreamTrack; mediaStreamTrack?: MediaStreamTrack }): Promise<void> => {
    const track = opts.track ?? opts.mediaStreamTrack;
    if (track) {
      this.originalTrack = track;
    }
    await this.ensureGraph();
  };

  setEnabled = async (enable: boolean): Promise<boolean> => {
    this.enabled = enable;
    this.processor.setNoiseSuppressionEnabled(enable);
    return this.enabled;
  };

  setSuppressionLevel(level: number): void {
    this.processor.setSuppressionLevel(level);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isNoiseSuppressionEnabled(): boolean {
    return this.processor.isNoiseSuppressionEnabled();
  }

  suspend = async (): Promise<void> => {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }
  };

  resume = async (): Promise<void> => {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  };

  destroy = async (): Promise<void> => {
    await this.teardownGraph();
    this.processor.destroy();
  };

  private async ensureGraph(): Promise<void> {
    if (!this.originalTrack) {
      throw new Error('No source track');
    }

    this.audioContext ??= new AudioContext({ sampleRate: 48000 });

    if (this.audioContext.state !== 'running') {
      try {
        await this.audioContext.resume();
      } catch {
        // Ignore resume errors
      }
    }

    await this.processor.initialize();

    if (!this.workletNode) {
      const node = await this.processor.createAudioWorkletNode(this.audioContext);
      this.workletNode = node;
    }

    if (!this.destination) {
      this.destination = this.audioContext.createMediaStreamDestination();
      this.processedTrack = this.destination.stream.getAudioTracks()[0];
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
    }

    this.sourceNode = this.audioContext.createMediaStreamSource(new MediaStream([this.originalTrack]));

    this.sourceNode.connect(this.workletNode).connect(this.destination);

    await this.setEnabled(this.enabled);
  }

  private async teardownGraph(): Promise<void> {
    try {
      if (this.workletNode) {
        this.workletNode.disconnect();
        this.workletNode = null;
      }
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.destination) {
        this.destination.disconnect();
        this.destination = null;
      }
      if (this.audioContext) {
        void this.audioContext.close();
        this.audioContext = null;
      }
    } catch {
      // Ignore disconnect errors
    }
  }
}

export function DeepFilterNoiseFilter(options?: DeepFilterNoiseFilterOptions): DeepFilterNoiseFilterProcessor {
  return new DeepFilterNoiseFilterProcessor(options);
}

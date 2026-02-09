import * as wasm_bindgen from '../df3/df';
import { WorkletMessageTypes } from '../constants';
import type { ProcessorOptions, DeepFilterModel } from '../interfaces';


class DeepFilterAudioProcessor extends AudioWorkletProcessor {
  private dfModel: DeepFilterModel | null = null;
  private inputBuffer: Float32Array;
  private outputBuffer: Float32Array;
  private inputWritePos = 0;
  private inputReadPos = 0;
  private outputWritePos = 0;
  private outputReadPos = 0;
  private bypass = false;
  private isInitialized = false;
  private bufferSize: number;
  private tempFrame: Float32Array | null = null;
  private stats = {
    count: 0,
    totalTime: 0,
    maxTime: 0,
    minTime: Infinity
  };

  constructor(options: AudioWorkletNodeOptions & { processorOptions: ProcessorOptions }) {
    super();

    this.bufferSize = 8192;
    this.inputBuffer = new Float32Array(this.bufferSize);
    this.outputBuffer = new Float32Array(this.bufferSize);

    try {
      // Initialize WASM from pre-compiled module
      wasm_bindgen.initSync(options.processorOptions.wasmModule);

      const modelBytes = new Uint8Array(options.processorOptions.modelBytes);
      const handle = wasm_bindgen.df_create(
        modelBytes,
        options.processorOptions.suppressionLevel ?? 50
      );

      const frameLength = wasm_bindgen.df_get_frame_length(handle);

      this.dfModel = { handle, frameLength };

      this.bufferSize = frameLength * 4;
      console.log('frameLength', frameLength);
      console.log('bufferSize', this.bufferSize);
      this.inputBuffer = new Float32Array(this.bufferSize);
      this.outputBuffer = new Float32Array(this.bufferSize);

      // Pre-allocate temp frame buffer for processing
      this.tempFrame = new Float32Array(frameLength);

      this.isInitialized = true;

      this.port.onmessage = (event: MessageEvent) => {
        this.handleMessage(event.data);
      };
    } catch (error) {
      console.error('Failed to initialize DeepFilter in AudioWorklet:', error);
      this.isInitialized = false;
    }
  }

  private handleMessage(data: { type: string; value?: number | boolean }): void {
    switch (data.type) {
      case WorkletMessageTypes.SET_SUPPRESSION_LEVEL:
        if (this.dfModel && typeof data.value === 'number') {
          const level = Math.max(0, Math.min(100, Math.floor(data.value)));
          wasm_bindgen.df_set_atten_lim(this.dfModel.handle, level);
        }
        break;
      case WorkletMessageTypes.SET_BYPASS:
        this.bypass = Boolean(data.value);
        break;
    }
  }

  private getInputAvailable(): number {
    return (this.inputWritePos - this.inputReadPos + this.bufferSize) % this.bufferSize;
  }

  private getOutputAvailable(): number {
    return (this.outputWritePos - this.outputReadPos + this.bufferSize) % this.bufferSize;
  }

  process(inputList: Float32Array[][], outputList: Float32Array[][]): boolean {
    const sourceLimit = Math.min(inputList.length, outputList.length);

    const input = inputList[0]?.[0];
    if (!input) {
      return true;
    }

    // Passthrough mode - copy input to all output channels
    if (!this.isInitialized || !this.dfModel || this.bypass || !this.tempFrame) {
      for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
        const output = outputList[inputNum];
        const channelCount = output.length;
        for (let channelNum = 0; channelNum < channelCount; channelNum++) {
          output[channelNum].set(input);
        }
      }
      return true;
    }

    // Write input to ring buffer
    for (let i = 0; i < input.length; i++) {
      this.inputBuffer[this.inputWritePos] = input[i];
      this.inputWritePos = (this.inputWritePos + 1) % this.bufferSize;
    }

    const frameLength = this.dfModel.frameLength;

    while (this.getInputAvailable() >= frameLength) {
      // Extract frame from ring buffer
      for (let i = 0; i < frameLength; i++) {
        this.tempFrame[i] = this.inputBuffer[this.inputReadPos];
        this.inputReadPos = (this.inputReadPos + 1) % this.bufferSize;
      }

      const start = Date.now();
      const processed = wasm_bindgen.df_process_frame(this.dfModel.handle, this.tempFrame);
      const end = Date.now();
      const duration = end - start;

      // Update statistics
      this.stats.count++;
      this.stats.totalTime += duration;
      this.stats.maxTime = Math.max(this.stats.maxTime, duration);
      this.stats.minTime = Math.min(this.stats.minTime, duration);

      // Log every 100 frames (approx every 1-2 seconds depending on hop size)
      if (this.stats.count >= 100) {
        const avg = this.stats.totalTime / this.stats.count;
        console.log(
          `[DeepFilter Stats] Frames: 100 | ` +
          `Avg: ${avg.toFixed(3)}ms | ` +
          `Min: ${this.stats.minTime.toFixed(3)}ms | ` +
          `Max: ${this.stats.maxTime.toFixed(3)}ms`
        );

        // Reset stats
        this.stats.count = 0;
        this.stats.totalTime = 0;
        this.stats.maxTime = 0;
        this.stats.minTime = Infinity;
      }

      // Write to output ring buffer
      for (let i = 0; i < processed.length; i++) {
        this.outputBuffer[this.outputWritePos] = processed[i];
        this.outputWritePos = (this.outputWritePos + 1) % this.bufferSize;
      }
    }

    const outputAvailable = this.getOutputAvailable();
    if (outputAvailable >= 128) {
      for (let inputNum = 0; inputNum < sourceLimit; inputNum++) {
        const output = outputList[inputNum];
        const channelCount = output.length;

        for (let channelNum = 0; channelNum < channelCount; channelNum++) {
          const outputChannel = output[channelNum];
          let readPos = this.outputReadPos;

          for (let i = 0; i < 128; i++) {
            outputChannel[i] = this.outputBuffer[readPos];
            readPos = (readPos + 1) % this.bufferSize;
          }
        }
      }
      this.outputReadPos = (this.outputReadPos + 128) % this.bufferSize;
    }
    return true;
  }
}

registerProcessor('deepfilter-audio-processor', DeepFilterAudioProcessor);

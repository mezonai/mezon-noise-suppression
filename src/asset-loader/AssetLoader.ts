import type { AssetConfig, AssetUrls } from '../interfaces';

export type { AssetConfig, AssetUrls };

export class AssetLoader {
  private readonly cdnUrl: string;

  constructor(config: AssetConfig = {}) {
    this.cdnUrl = config.cdnUrl ?? 'https://cdn.mezon.ai/AI/models/datas/noise_suppression/deepfilternet3';
  }

  private getCdnUrl(relativePath: string): string {
    return `${this.cdnUrl}/${relativePath}`;
  }

  getAssetUrls(): AssetUrls {
    return {
      wasm: this.getCdnUrl('pkg/df_bg_v2.wasm'),
      model: this.getCdnUrl('models/DeepFilterNet3_onnx.tar.gz')
    };
  }

  async fetchAsset(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${response.statusText}`);
    }
    return response.arrayBuffer();
  }
}

let defaultLoader: AssetLoader | null = null;

export function getAssetLoader(config?: AssetConfig): AssetLoader {
  if (!defaultLoader || config) {
    defaultLoader = new AssetLoader(config);
  }
  return defaultLoader;
}

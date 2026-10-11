import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class AssetLoader {
  constructor() {
    this.gltf = new GLTFLoader();
  }

  async loadGLTF(url, fallbackFactory) {
    try {
      const asset = await this.gltf.loadAsync(url);
      return { object: asset.scene, source: url, fallback: false };
    } catch (error) {
      console.warn(`[asset] ${url} 加载失败，已切换占位模型。`, error);
      return { object: fallbackFactory(), source: null, fallback: true };
    }
  }
}

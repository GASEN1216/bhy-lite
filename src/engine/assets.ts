/**
 * 资源加载：把 public/assets/ 下的 png / wav 加载到内存。
 * 渲染层通过 getImages() 拿到已经准备好的 CanvasImageSource。
 *
 * 容错：任意资源失败不阻断游戏；渲染层会用彩色矩形作为兜底。
 */

import { ASSETS, TILE_SPRITES } from '../core/constants';

export interface ImageBundle {
  tiles: HTMLImageElement;
  actors: HTMLImageElement;
  objects: HTMLImageElement;
  doors: HTMLImageElement;
}

export interface AudioHandle {
  [name: string]: HTMLAudioElement | null;
}

export class AssetLoader {
  images: Partial<ImageBundle> = {};
  audio: AudioHandle = {};
  loaded = false;

  async load(): Promise<void> {
    const [tiles, actors, objects, doors] = await Promise.all([
      this.img(ASSETS.images.tiles),
      this.img(ASSETS.images.actors),
      this.img(ASSETS.images.objects),
      this.img(ASSETS.images.doors),
    ]);
    this.images = { tiles, actors, objects, doors };

    // 预加载音效
    for (const [name, url] of Object.entries(ASSETS.audio)) {
      try {
        const a = new window.Audio(url);
        a.preload = 'auto';
        this.audio[name] = a;
      } catch {
        this.audio[name] = null;
      }
    }
    this.loaded = true;
  }

  private img(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = (e) => reject(e);
      i.src = src;
    });
  }
}

export const TILE_SHEET_INDEX = TILE_SPRITES;
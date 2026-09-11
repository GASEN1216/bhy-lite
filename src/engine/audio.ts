/**
 * 音频管理器 —— 用原生 <audio> 元素播放 wav。
 * BGM 自动循环；音效独立播放（可重叠）。
 * 音量分 master / bgm / sfx 三档。
 */

import { ASSETS } from '../core/constants';

export class AudioManager {
  private master = 0.8;
  private bgmVol = 0.6;
  private sfxVol = 0.9;
  private bgmEl: HTMLAudioElement | null = null;
  private sfxCache: Map<string, HTMLAudioElement> = new Map();
  private muted = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const el = new window.Audio(ASSETS.audio.bgm);
      el.loop = true;
      el.preload = 'auto';
      this.bgmEl = el;
    }
  }

  setVolumes(master: number, bgm: number, sfx: number): void {
    this.master = master;
    this.bgmVol = bgm;
    this.sfxVol = sfx;
    if (this.bgmEl) this.bgmEl.volume = clamp01(master * bgm);
  }

  getVolumes(): { master: number; bgm: number; sfx: number } {
    return { master: this.master, bgm: this.bgmVol, sfx: this.sfxVol };
  }

  startBgm(): void {
    if (!this.bgmEl || this.muted) return;
    this.bgmEl.volume = clamp01(this.master * this.bgmVol);
    this.bgmEl.play().catch(() => undefined);
  }

  stopBgm(): void {
    this.bgmEl?.pause();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.bgmEl) this.bgmEl.volume = m ? 0 : clamp01(this.master * this.bgmVol);
  }

  play(name: string): void {
    if (this.muted) return;
    const url = (ASSETS.audio as Record<string, string>)[name];
    if (!url) return;
    let el = this.sfxCache.get(name);
    if (!el) {
      el = new window.Audio(url);
      el.preload = 'auto';
      this.sfxCache.set(name, el);
    }
    el.volume = clamp01(this.master * this.sfxVol);
    const clone = el.cloneNode(true) as HTMLAudioElement;
    clone.volume = el.volume;
    clone.play().catch(() => undefined);
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
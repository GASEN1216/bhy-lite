/**
 * 本地存档：localStorage（key 走常量）。
 *  - 各级最佳成绩 / 通关用时 / 收集宝石 / 星级
 *  - 关卡解锁：根据前一关是否至少 1 星解锁
 *  - 设置：音量
 *
 * 通过注入 storage 接口便于测试（默认走 window.localStorage）。
 */

import { SAVE_KEY, SETTINGS_KEY } from '../core/constants';

export interface LevelProgress {
  bestTime: number; // s；未通关则 NaN
  stars: 0 | 1 | 2 | 3;
  gems: number;
  /** 1 = 解锁 0 = 锁定 */
  unlocked: 0 | 1;
  /** 是否通关过 */
  completed: 0 | 1;
}

export interface SaveData {
  version: 1;
  levels: Record<number, LevelProgress>;
}

export interface SettingsData {
  version: 1;
  master: number; // 0..1
  bgm: number; // 0..1
  sfx: number; // 0..1
}

export interface KVStorage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const DEFAULT_PROGRESS = (): LevelProgress => ({
  bestTime: NaN,
  stars: 0,
  gems: 0,
  unlocked: 0,
  completed: 0,
});

function defaultStorage(): KVStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  // Node / SSR fallback：内存 stub
  const mem = new Map<string, string>();
  return {
    getItem: (k) => (mem.has(k) ? (mem.get(k) as string) : null),
    setItem: (k, v) => { mem.set(k, v); },
    removeItem: (k) => { mem.delete(k); },
  };
}

export function makeSave(_storage?: KVStorage) {
  const storage = _storage ?? defaultStorage();
  return {
    load(): SaveData {
      const raw = readJSON<Partial<SaveData>>(storage, SAVE_KEY, { version: 1, levels: {} });
      const levels: Record<number, LevelProgress> = {};
      for (const k of Object.keys(raw.levels ?? {})) {
        const id = Number(k);
        const v = (raw.levels ?? {})[id] ?? {};
        levels[id] = { ...DEFAULT_PROGRESS(), ...v };
      }
      if (!levels[1]) levels[1] = { ...DEFAULT_PROGRESS(), unlocked: 1 };
      return { version: 1, levels };
    },

    progress(save: SaveData, id: number): LevelProgress {
      return save.levels[id] ?? DEFAULT_PROGRESS();
    },

    apply(save: SaveData, id: number, patch: Partial<LevelProgress>): SaveData {
      const prev = save.levels[id] ?? DEFAULT_PROGRESS();
      const merged: LevelProgress = { ...prev, ...patch };
      // bestTime 保留更小值
      if (
        Number.isFinite(prev.bestTime) &&
        Number.isFinite(patch.bestTime ?? NaN)
      ) {
        merged.bestTime = Math.min(prev.bestTime, patch.bestTime as number);
      } else if (Number.isFinite(patch.bestTime ?? NaN)) {
        merged.bestTime = patch.bestTime as number;
      } else {
        merged.bestTime = prev.bestTime;
      }
      merged.unlocked = 1;
      save.levels[id] = merged;
      if (merged.completed) {
        save.levels[id + 1] = { ...(save.levels[id + 1] ?? DEFAULT_PROGRESS()), unlocked: 1 };
      }
      writeJSON(storage, SAVE_KEY, save);
      return save;
    },

    reset(): void {
      storage.removeItem(SAVE_KEY);
      storage.removeItem(SETTINGS_KEY);
    },
  };
}

export function makeSettings(_storage?: KVStorage) {
  const storage = _storage ?? defaultStorage();
  return {
    load(): SettingsData {
      return readJSON<SettingsData>(storage, SETTINGS_KEY, {
        version: 1,
        master: 0.8,
        bgm: 0.6,
        sfx: 0.9,
      });
    },
    save(s: SettingsData): void {
      writeJSON(storage, SETTINGS_KEY, s);
    },
  };
}

// 默认实例：UI / 引擎使用
export function loadSave(): SaveData { return makeSave().load(); }
export function getProgress(save: SaveData, id: number): LevelProgress { return makeSave().progress(save, id); }
export function applyResult(save: SaveData, id: number, patch: Partial<LevelProgress>): SaveData { return makeSave().apply(save, id, patch); }
export function loadSettings(): SettingsData { return makeSettings().load(); }
export function saveSettings(s: SettingsData): void { makeSettings().save(s); }
export function resetAll(): void { makeSave().reset(); }

function readJSON<T>(storage: KVStorage, key: string, fallback: T): T {
  try {
    const s = storage.getItem(key);
    if (!s) return fallback;
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(storage: KVStorage, key: string, value: unknown): void {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* 容量上限或隐私模式：忽略 */
  }
}
import { describe, expect, it } from 'vitest';
import { makeSave, makeSettings, type KVStorage } from '../src/game/save';

function memStorage(): KVStorage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

describe('game/save', () => {
  it('首次加载：第 1 关默认解锁', () => {
    const sv = makeSave(memStorage());
    const data = sv.load();
    expect(data.levels[1].unlocked).toBe(1);
    expect(data.levels[2]?.unlocked ?? 0).toBe(0);
  });

  it('applyResult 通关后下一关解锁', () => {
    const storage = memStorage();
    const sv = makeSave(storage);
    const data = sv.load();
    sv.apply(data, 1, { bestTime: 12.5, stars: 2, gems: 4, completed: 1 });
    const reload = sv.load();
    expect(reload.levels[1].stars).toBe(2);
    expect(reload.levels[1].unlocked).toBe(1);
    expect(reload.levels[2].unlocked).toBe(1);
  });

  it('applyResult 保留更短的 bestTime', () => {
    const storage = memStorage();
    const sv = makeSave(storage);
    const data = sv.load();
    sv.apply(data, 1, { bestTime: 20, stars: 3, gems: 4, completed: 1 });
    sv.apply(data, 1, { bestTime: 25, stars: 3, gems: 4, completed: 1 });
    expect(sv.load().levels[1].bestTime).toBe(20);
  });

  it('settings 持久化', () => {
    const storage = memStorage();
    const st = makeSettings(storage);
    const s = st.load();
    expect(s.version).toBe(1);
    st.save({ version: 1, master: 0.2, bgm: 0.3, sfx: 0.4 });
    expect(st.load().sfx).toBe(0.4);
  });
});
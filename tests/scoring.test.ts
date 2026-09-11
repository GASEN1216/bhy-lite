import { describe, expect, it } from 'vitest';
import { computeScore } from '../src/game/scoring';
import { LEVELS, buildLevel } from '../src/game/levels';

describe('game/scoring', () => {
  it('未通关零星', () => {
    const lv = LEVELS[0];
    const s = computeScore(lv, { elapsed: 5, gemsCollected: 0, totalGems: 0, won: false });
    expect(s.stars).toBe(0);
  });

  it('通关 + 宝石 + 时间均达标 → 3 星', () => {
    const lv = LEVELS[0];
    const s = computeScore(lv, { elapsed: lv.twoStarTime, gemsCollected: lv.gems.length, totalGems: lv.gems.length, won: true });
    expect(s.stars).toBe(3);
  });

  it('通关但未达条件 → 1 星', () => {
    const lv = LEVELS[0];
    const s = computeScore(lv, { elapsed: lv.twoStarTime + 100, gemsCollected: 0, totalGems: lv.gems.length, won: true });
    expect(s.stars).toBe(1);
  });

  it('buildLevel 解析 map 中的宝石 / 出生点', () => {
    const lv = buildLevel({
      id: 99,
      name: 't',
      hint: '',
      twoStarTime: 10,
      map: `
.........
.F.r....
..####..
.W....d.
.........
D........`
        .replace(/^\n/, ''),
    });
    expect(lv.gems.length).toBe(1);
    expect(lv.spawns.fire.x).toBe(1);
    expect(lv.boxes.length).toBe(0);
  });
});
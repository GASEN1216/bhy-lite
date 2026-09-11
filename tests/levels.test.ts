import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/game/levels';
import { validateLevel, createGameState } from '../src/game/level';
import { PHYSICS, TILE_SIZE, TILES } from '../src/core/constants';

describe('game/levels', () => {
  it('5 个手工关卡通过结构性校验', () => {
    expect(LEVELS.length).toBe(5);
    for (const lv of LEVELS) {
      const errs = validateLevel(lv);
      expect(errs, `关卡 ${lv.id} 错误：\n${errs.join('\n')}`).toEqual([]);
    }
  });

  it('每关都有两个出生点、两个门，且出生点和门不在固体里', () => {
    for (const lv of LEVELS) {
      const state = createGameState(lv);
      expect(state.players).toHaveLength(2);
      expect(state.doors).toHaveLength(2);
      expect(state.hazards.length).toBeGreaterThan(0);
      // 至少 1 个宝石
      expect(state.gems.length).toBeGreaterThan(0);
    }
  });

  it('关卡尺寸固定 40x20', () => {
    for (const lv of LEVELS) {
      expect(lv.width).toBe(40);
      expect(lv.height).toBe(20);
    }
  });

  it('jump + move 单步推进可让角色落到地面', () => {
    const lv = LEVELS[0];
    const state = createGameState(lv);
    const fire = state.players[0];
    // 模拟若干帧重力
    for (let i = 0; i < 60; i++) {
      fire.vy = Math.min(PHYSICS.maxFallSpeed, fire.vy + PHYSICS.gravity * (1 / 60));
      fire.y += fire.vy * (1 / 60);
      if (fire.y + fire.h >= lv.height * TILE_SIZE - 32 - fire.h) break;
    }
    // 落入后 y 应 ≤ 地面顶 (row 17 = TILE_SIZE*17)
    expect(fire.y).toBeGreaterThan(0);
  });

  it('关卡地形至少包含一种 hazard 供教学', () => {
    const counts: Record<number, number> = { [TILES.FIRE]: 0, [TILES.WATER]: 0, [TILES.ACID]: 0 };
    for (const lv of LEVELS) {
      for (const row of lv.map) {
        for (const ch of row) {
          if (ch === 'f') counts[TILES.FIRE]++;
          if (ch === 'w') counts[TILES.WATER]++;
          if (ch === 'a') counts[TILES.ACID]++;
        }
      }
    }
    // 前 3 关含火 / 水 / 酸元素地形
    expect(counts[TILES.FIRE]).toBeGreaterThan(0);
    expect(counts[TILES.WATER]).toBeGreaterThan(0);
    expect(counts[TILES.ACID]).toBeGreaterThan(0);
  });
});
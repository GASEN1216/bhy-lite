import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/level';
import { findLevel, LEVELS } from '../src/game/levels';
import { Input } from '../src/engine/input';
import { stepWorld } from '../src/game/world';
import { TILE_SIZE } from '../src/core/constants';
import type { GameState } from '../src/core/types';

/** 把角色瞬移到某一格（脚底贴该格下方的地面） */
function place(p: GameState['players'][number], col: number, row: number): void {
  p.x = col * TILE_SIZE + (TILE_SIZE - p.w) / 2;
  p.y = (row + 1) * TILE_SIZE - p.h;
  p.vx = 0;
  p.vy = 0;
}

function gate(state: GameState, id: string) {
  const g = state.gates.find((x) => x.def.id === id);
  if (!g) throw new Error(`no gate ${id}`);
  return g;
}
function trigger(state: GameState, id: string) {
  const t = state.triggers.find((x) => x.def.id === id);
  if (!t) throw new Error(`no trigger ${id}`);
  return t;
}
function platform(state: GameState, id: string) {
  const p = state.platforms.find((x) => x.def.id === id);
  if (!p) throw new Error(`no platform ${id}`);
  return p;
}

describe('game/mechanisms', () => {
  it('L3：无人踩按钮时闸门是固体；人站上去后闸门打开', () => {
    const state = createGameState(findLevel(3));
    expect(gate(state, 'gate-main').solid).toBe(true);

    const input = new Input();
    // 把水女放到左侧按钮（col 11, row 16）
    place(state.players[1], 11, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'btn-left').active).toBe(true);
    expect(gate(state, 'gate-main').solid).toBe(false);

    // 走开 → 按钮弹起 → 闸门重新关闭
    place(state.players[1], 4, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'btn-left').active).toBe(false);
    expect(gate(state, 'gate-main').solid).toBe(true);
  });

  it('L3：第 14 列闸门关闭时挡住去路，打开后可以穿过', () => {
    const closed = createGameState(findLevel(3));
    const fire = closed.players[0];
    place(fire, 12, 16);
    const input = new Input();
    // 一直向右走 2 秒：闸门关着应该被挡在 col 14 左边
    for (let i = 0; i < 120; i++) {
      input._set('fire-right', true);
      stepWorld(closed, input, {}, 1 / 60);
      input.endFrame();
    }
    expect(fire.x + fire.w).toBeLessThanOrEqual(14 * TILE_SIZE + 1);
  });

  it('L2：拉杆边缘触发，踩一次切换平台开关', () => {
    const state = createGameState(findLevel(2));
    expect(platform(state, 'plat-bridge').active).toBe(false);

    const input = new Input();
    place(state.players[0], 8, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'lever-bridge').active).toBe(true);
    expect(platform(state, 'plat-bridge').active).toBe(true);

    // 走开后拉杆状态保持（lever 是保持型）
    place(state.players[0], 2, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'lever-bridge').active).toBe(true);

    // 再踩一次 → 关闭
    place(state.players[0], 8, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'lever-bridge').active).toBe(false);
  });

  it('L2：平台开启后会沿 X 轴往复移动，且移动范围在关卡内', () => {
    const state = createGameState(findLevel(2));
    place(state.players[0], 8, 16);
    const input = new Input();
    stepWorld(state, input, {}, 1 / 60);

    const p = platform(state, 'plat-bridge');
    const startX = p.x;
    for (let i = 0; i < 60; i++) stepWorld(state, input, {}, 1 / 60);
    expect(p.x).not.toBe(startX);
    expect(p.x).toBeGreaterThanOrEqual(14 * TILE_SIZE - 1);
    expect(p.x).toBeLessThanOrEqual(17 * TILE_SIZE + 1);
  });

  it('L4：箱子压住按钮后闸门长开（人走开也保持）', () => {
    const state = createGameState(findLevel(4));
    expect(gate(state, 'gate-main').solid).toBe(true);
    const input = new Input();

    // 把箱子放到按钮格（col 16, row 16）
    const box = state.boxes[0];
    box.x = 16 * TILE_SIZE + (TILE_SIZE - box.w) / 2;
    box.y = (16 + 1) * TILE_SIZE - box.h;
    stepWorld(state, input, {}, 1 / 60);
    expect(trigger(state, 'btn-box').active).toBe(true);
    expect(gate(state, 'gate-main').solid).toBe(false);
  });

  it('L4：火男能把箱子向右推动', () => {
    const state = createGameState(findLevel(4));
    const box = state.boxes[0];
    const startX = box.x;
    const fire = state.players[0];
    // 火男站到箱子左边
    place(fire, 6, 16);
    fire.x = box.x - fire.w - 1;
    const input = new Input();
    for (let i = 0; i < 120; i++) {
      input._set('fire-right', true);
      stepWorld(state, input, {}, 1 / 60);
      input.endFrame();
    }
    expect(box.x).toBeGreaterThan(startX);
  });

  it('L5：自动平台无需触发器也会一直往返', () => {
    const state = createGameState(findLevel(5));
    const p = platform(state, 'plat-bridge');
    const input = new Input();
    const startX = p.x;
    for (let i = 0; i < 30; i++) stepWorld(state, input, {}, 1 / 60);
    expect(p.x).not.toBe(startX);
    expect(p.x).toBeGreaterThanOrEqual(10 * TILE_SIZE - 1);
    expect(p.x).toBeLessThanOrEqual(13 * TILE_SIZE + 1);
  });

  it('升降台：开启后沿 Y 轴上升，且骑乘者被一起带走', () => {
    const state = createGameState(findLevel(2));
    const input = new Input();
    // 打开升降台
    place(state.players[0], 28, 16);
    stepWorld(state, input, {}, 1 / 60);
    expect(platform(state, 'plat-lift').active).toBe(true);

    // 把水女放到升降台上（col 32, row 16）
    const lift = platform(state, 'plat-lift');
    const water = state.players[1];
    water.x = lift.x + (lift.def.w * TILE_SIZE - water.w) / 2;
    water.y = lift.y - water.h;
    water.vx = 0;
    water.vy = 0;
    const y0 = water.y;
    for (let i = 0; i < 90; i++) stepWorld(state, input, {}, 1 / 60);
    // 升降台向上（distance 为负），骑乘者应随之上升
    expect(water.y).toBeLessThan(y0);
    expect(water.onGround).toBe(true);
  });

  it('所有关卡的机关 id 都能被正确解析（无悬空引用）', () => {
    for (const lv of LEVELS) {
      const state = createGameState(lv);
      const ids = new Set<string>();
      state.triggers.forEach((t) => ids.add(t.def.id));
      for (const p of state.platforms) {
        for (const target of p.def.targets) expect(ids.has(target), `L${lv.id} ${p.def.id}->${target}`).toBe(true);
      }
      for (const g of state.gates) {
        for (const target of g.def.targets) expect(ids.has(target), `L${lv.id} ${g.def.id}->${target}`).toBe(true);
      }
    }
  });
});

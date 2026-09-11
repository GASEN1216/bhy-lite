import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/level';
import { LEVELS } from '../src/game/levels';
import { Input } from '../src/engine/input';
import { stepWorld } from '../src/game/world';
import { PHYSICS, TILE_SIZE } from '../src/core/constants';

/**
 * 集成测试：用合成输入推进一帧，验证世界 step 的关键不变式：
 *  - 角色能移动
 *  - 重力会落地
 *  - 危险地形会触发死亡
 *  - 跳跃可到达上方平台
 */
describe('game/world 集成', () => {
  it('从出生点自由落体 2 秒后稳定站在地面上', () => {
    const state = createGameState(LEVELS[0]);
    const fire = state.players[0];
    const input = new Input();
    for (let i = 0; i < 120; i++) stepWorld(state, input, {}, 1 / 60);
    // 出生在 (2,16) → 站在第 17 行地面上，脚底 y = 17 * 32 = 544
    expect(fire.y + fire.h).toBeCloseTo(544, 0);
    expect(fire.onGround).toBe(true);
    expect(state.status).toBe('playing');
  });

  it('横向走 + 跳跃不会穿墙 / 不会卡死', () => {
    const state = createGameState(LEVELS[0]);
    const fire = state.players[0];
    const input = new Input();
    for (let i = 0; i < 120; i++) {
      input._set('fire-right', true);
      input._set('fire-jump', i % 30 === 0);
      stepWorld(state, input, {}, 1 / 60);
      input.endFrame();
    }
    expect(fire.x).toBeGreaterThan(0);
    expect(fire.x).toBeLessThan(LEVELS[0].width * TILE_SIZE);
  });

  it('站在地面时按跳跃，Y 出现一段时间的负速度', () => {
    const state = createGameState(LEVELS[0]);
    const fire = state.players[0];
    const input = new Input();
    // 先落地
    for (let i = 0; i < 60; i++) stepWorld(state, input, {}, 1 / 60);
    expect(fire.onGround).toBe(true);
    input._set('fire-jump', true);
    stepWorld(state, input, {}, 1 / 60);
    expect(fire.vy).toBeLessThan(0); // 跳跃初始速度为负
    input.endFrame();
  });

  it('火男掉进水池会死亡，水女掉进火池会死亡，各自免疫自己的元素', () => {
    const lv = LEVELS[0]; // L1: 水坑 col 11~13，火坑 col 17~19
    const input = new Input();

    // 火男 → 水池（col 13）
    const s1 = createGameState(lv);
    s1.players[0].x = 12 * TILE_SIZE + 7;
    s1.players[0].y = 480;
    for (let i = 0; i < 30; i++) stepWorld(s1, input, {}, 1 / 60);
    expect(s1.status).toBe('dead');

    // 水女 → 火池（col 21）
    const s2 = createGameState(lv);
    s2.players[1].x = 18 * TILE_SIZE + 7;
    s2.players[1].y = 480;
    for (let i = 0; i < 30; i++) stepWorld(s2, input, {}, 1 / 60);
    expect(s2.status).toBe('dead');

    // 火男 → 火池：免疫，不死
    const s3 = createGameState(lv);
    s3.players[0].x = 18 * TILE_SIZE + 7;
    s3.players[0].y = 480;
    for (let i = 0; i < 30; i++) stepWorld(s3, input, {}, 1 / 60);
    expect(s3.status).not.toBe('dead');

    // 水女 → 水池：免疫，不死
    const s4 = createGameState(lv);
    s4.players[1].x = 12 * TILE_SIZE + 7;
    s4.players[1].y = 480;
    for (let i = 0; i < 30; i++) stepWorld(s4, input, {}, 1 / 60);
    expect(s4.status).not.toBe('dead');
  });

  it('死亡后 0.85 秒自动复位并恢复 playing', () => {
    const state = createGameState(LEVELS[0]);
    const input = new Input();
    state.players[0].x = 12 * TILE_SIZE + 7;
    state.players[0].y = 480;
    for (let i = 0; i < 30; i++) stepWorld(state, input, {}, 1 / 60);
    expect(state.status).toBe('dead');
    for (let i = 0; i < 60; i++) stepWorld(state, input, {}, 1 / 60);
    expect(state.status).toBe('playing');
    expect(state.players[0].dead).toBe(false);
    // 复位到出生点
    expect(state.players[0].x).toBeCloseTo(2 * TILE_SIZE + (TILE_SIZE - 18) / 2, 0);
  });
});

void PHYSICS;
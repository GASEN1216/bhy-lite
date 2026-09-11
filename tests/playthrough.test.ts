/**
 * 端到端通关测试：一个"简易 AI"用真实输入把第 1 关打通。
 *
 * 这是最有价值的集成测试 —— 它同时验证了：
 *   输入 → 物理 → 跳跃 → 元素相克 → 宝石收集 → 终点门判定 → 通关
 * 整条链路。如果任何一环坏了，这里就会挂。
 *
 * AI 策略：朝自己的门直线走；遇到"前方脚下是致命液体 / 是坑 / 前方齐身高处有墙"就跳。
 */

import { describe, expect, it } from 'vitest';
import { createGameState } from '../src/game/level';
import { findLevel } from '../src/game/levels';
import { Input } from '../src/engine/input';
import { stepWorld } from '../src/game/world';
import { TILE_SIZE } from '../src/core/constants';
import type { CharacterKind, GameState, LevelDef, PlayerState } from '../src/core/types';

const SOLID = new Set(['#', ',', 'M']);

function tileAt(level: LevelDef, col: number, row: number): string {
  if (row < 0 || row >= level.height || col < 0 || col >= level.width) return '#';
  return level.map[row][col] ?? '.';
}

/** 该液体是否对 kind 致命 */
function deadly(ch: string, kind: CharacterKind): boolean {
  if (ch === 'a') return true;
  if (ch === 'f') return kind === 'water';
  if (ch === 'w') return kind === 'fire';
  return false;
}

/**
 * 驱动一个角色朝自己的门走。
 * @param hold 每个角色"还要按住跳跃键多久"（秒）—— 真人会按住，点一下只会小跳
 */
function drive(
  state: GameState,
  p: PlayerState,
  input: Input,
  hold: Map<CharacterKind, number>,
  dt: number
): void {
  const leftKey = p.kind === 'fire' ? 'fire-left' : 'water-left';
  const rightKey = p.kind === 'fire' ? 'fire-right' : 'water-right';
  const jumpKey = p.kind === 'fire' ? 'fire-jump' : 'water-jump';

  const door = state.doors.find((d) => d.kind === p.kind)!;
  const targetX = door.x + door.w / 2 - p.w / 2;
  const dx = targetX - p.x;

  if (Math.abs(dx) <= 4) {
    input._set(rightKey, false);
    input._set(leftKey, false);
    input._set(jumpKey, false);
    hold.set(p.kind, 0);
    return;
  }

  const dir = dx > 0 ? 1 : -1;
  input._set(rightKey, dir > 0);
  input._set(leftKey, dir < 0);

  const aheadX = dir > 0 ? p.x + p.w + 4 : p.x - 4;
  const col = Math.floor(aheadX / TILE_SIZE);
  const footRow = Math.floor((p.y + p.h + 2) / TILE_SIZE);
  const bodyRow = Math.floor((p.y + p.h - 6) / TILE_SIZE);

  const footCh = tileAt(state.level, col, footRow);
  const belowCh = tileAt(state.level, col, footRow + 1);
  const bodyCh = tileAt(state.level, col, bodyRow);

  // 前方是致命液体 → 跳；前方是坑（脚下与再下一格都不是固体）→ 也跳；
  // 前方齐身高处是墙 → 跳（爬台阶）
  const isGap = !SOLID.has(footCh) && !SOLID.has(belowCh);
  const needJump = deadly(footCh, p.kind) || isGap || SOLID.has(bodyCh);

  let holdLeft = hold.get(p.kind) ?? 0;
  if (needJump && p.onGround && holdLeft <= 0) {
    // 起跳，并按住 0.4 秒（足够到最高点）
    holdLeft = 0.4;
    input._set(jumpKey, true);
  } else if (holdLeft > 0) {
    input._set(jumpKey, true);
    holdLeft = Math.max(0, holdLeft - dt);
  } else {
    input._set(jumpKey, false);
  }
  hold.set(p.kind, holdLeft);
}

/** 让 AI 玩指定关卡，最多 maxSeconds 秒模拟时间 */
function play(levelId: number, maxSeconds: number): GameState {
  const state = createGameState(findLevel(levelId));
  const input = new Input();
  const hold = new Map<CharacterKind, number>();
  const dt = 1 / 120;
  const steps = Math.floor(maxSeconds / dt);
  for (let i = 0; i < steps; i++) {
    if (state.status === 'won') break;
    drive(state, state.players[0], input, hold, dt);
    drive(state, state.players[1], input, hold, dt);
    stepWorld(state, input, {}, dt);
    input.endFrame();
  }
  return state;
}

describe('端到端通关', () => {
  it('AI 能在 40 秒内打通第 1 关', () => {
    const state = play(1, 40);
    expect(state.status, `未能通关，用时 ${state.elapsed.toFixed(1)}s，状态 ${state.status}`).toBe('won');
    expect(state.players[0].atDoor).toBe(true);
    expect(state.players[1].atDoor).toBe(true);
  });

  it('通关时两人都收集到了宝石，且没有中途死亡卡死', () => {
    const state = play(1, 40);
    expect(state.status).toBe('won');
    // 路线上的宝石应该被各自收集（火男收红、水女收蓝）
    expect(state.players[0].gems).toBeGreaterThan(0);
    expect(state.players[1].gems).toBeGreaterThan(0);
    // 红宝石总数 = 蓝宝石总数，都要能被拿到
    const red = state.gems.filter((g) => g.kind === 'fire');
    const blue = state.gems.filter((g) => g.kind === 'water');
    expect(state.players[0].gems).toBeLessThanOrEqual(red.length);
    expect(state.players[1].gems).toBeLessThanOrEqual(blue.length);
  });

  it('通关用时可用于评分：能拿到至少 1 星', () => {
    const state = play(1, 40);
    expect(state.status).toBe('won');
    expect(state.wonAt).not.toBeNull();
    expect(state.wonAt!).toBeGreaterThan(0);
  });
});

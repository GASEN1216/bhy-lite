/**
 * 评分与三星逻辑 —— 纯函数，可单测。
 */

import type { GameState, LevelDef } from '../core/types';

export interface RunResult {
  elapsed: number; // s
  gemsCollected: number;
  totalGems: number;
  won: boolean;
}

export interface ScoreBreakdown {
  stars: 0 | 1 | 2 | 3;
  timeBonus: boolean;
  gemBonus: boolean;
}

/**
 * 根据通关用时与宝石收集率算星。
 *  - 通关才可能得 1 星
 *  - 拿到全部宝石 +1 星
 *  - 用时 <= twoStarTime +1 星
 */
export function computeScore(def: LevelDef, r: RunResult): ScoreBreakdown {
  if (!r.won) return { stars: 0, timeBonus: false, gemBonus: false };
  const gemBonus = r.totalGems > 0 && r.gemsCollected >= r.totalGems;
  const timeBonus = r.elapsed <= def.twoStarTime;
  let stars: 0 | 1 | 2 | 3 = 1;
  if (gemBonus) stars = (stars + 1) as 1 | 2 | 3;
  if (timeBonus) stars = (stars + 1) as 1 | 2 | 3;
  return { stars, timeBonus, gemBonus };
}

/** 从当前 GameState 提取用于评分的快照 */
export function snapshotRun(state: GameState): RunResult {
  let collected = 0;
  let total = 0;
  for (const g of state.gems) {
    total += 1;
    if (g.collected) collected += 1;
  }
  return {
    elapsed: state.elapsed,
    gemsCollected: collected,
    totalGems: total,
    won: state.status === 'won',
  };
}
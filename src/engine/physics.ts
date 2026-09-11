/**
 * 离散 AABB 物理 —— 字符、箱子、移动平台、固体地形都使用同一套解算。
 *
 * 特性：
 *  - 单轴分别解算 (X then Y)，便于在每轴判断碰撞方向（落地 / 撞墙 / 撞顶）。
 *  - 子步位移（防止高速穿墙）。
 *  - 与地面碰撞时记录 landedId，调用方据此设置 ride，便于平台传送骑乘。
 *  - 任意两组之间可设置 group；同 group 跳过碰撞（用于两个角色互不阻挡）。
 *  - 同一调用既可"积分后求解"（带速度置零）也可"承载位移后求解"（不动速度）。
 */

import type { AABB } from '../core/types';
import { PHYSICS } from '../core/constants';

export type SolidKind = 'tile' | 'gate' | 'platform' | 'box' | 'character';

export interface Solid extends AABB {
  /** 唯一标识；落地时用作 ride.id */
  id: string;
  kind: SolidKind;
  /** 同 group 不互相碰撞；不同 group 总碰撞 */
  group?: number;
}

export interface Body {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  onGround: boolean;
  /** 站在其上的实体 id（仅作物理载具来源，无行为意义） */
  ride: { id: string } | null;
}

export interface CollisionResult {
  /** 撞墙方向：1=撞到右侧的墙，-1=撞到左侧；0=未撞 */
  hitWall: -1 | 0 | 1;
  hitCeiling: boolean;
  hitFloor: boolean;
  landedId: string | null;
}

function overlapsAABB(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function passesFilter(solid: Solid, selfId: string, selfGroup: number | undefined): boolean {
  if (solid.id === selfId) return false;
  if (selfGroup !== undefined && solid.group === selfGroup) return false;
  return true;
}

/* ----------------------- 单轴解算（核心） ----------------------- */

interface AxisResult {
  hitWall?: -1 | 0 | 1;
  hitFloor?: boolean;
  hitCeiling?: boolean;
  landedId?: string | null;
}

/**
 * 把 body 沿指定轴平移 totalDistance 像素，按子步解算重叠。移动方向由 totalDistance 的符号给出。
 * 返回碰撞信息（按轴返回）。
 */
function resolveAxis(
  body: Body,
  totalDistance: number,
  solids: Solid[],
  selfId: string,
  selfGroup: number | undefined,
  axis: 'x' | 'y',
  zeroVelocity: boolean
): AxisResult {
  const out: AxisResult = {};
  if (totalDistance === 0) return out;
  const maxStep = axis === 'x' ? PHYSICS.maxStepX : PHYSICS.maxStepY;
  const steps = Math.max(1, Math.ceil(Math.abs(totalDistance) / maxStep));
  const sMove = totalDistance / steps;
  const dir = Math.sign(totalDistance) as -1 | 0 | 1;

  for (let step = 0; step < steps; step++) {
    if (axis === 'x') body.x += sMove;
    else body.y += sMove;

    for (let iter = 0; iter < 4; iter++) {
      let bestPush = Infinity;
      let bestSnap = axis === 'x' ? body.x : body.y;
      let landedCandidate: string | null = null;
      for (const s of solids) {
        if (!passesFilter(s, selfId, selfGroup)) continue;
        if (!overlapsAABB(body, s)) continue;
        let snap: number;
        let push: number;
        if (axis === 'x') {
          if (dir > 0) {
            // 向右移动 → 撞到其左沿 → 向左推回
            snap = s.x - body.w;
            push = body.x - snap;
          } else if (dir < 0) {
            snap = s.x + s.w;
            push = snap - body.x;
          } else {
            const snapR = s.x - body.w;
            const pushR = body.x - snapR;
            const snapL = s.x + s.w;
            const pushL = snapL - body.x;
            if (pushR <= pushL) { snap = snapR; push = pushR; }
            else { snap = snapL; push = pushL; }
          }
        } else {
          if (dir > 0) {
            // 下落 → 撞到其顶 → 向上推回
            snap = s.y - body.h;
            push = body.y - snap;
          } else if (dir < 0) {
            snap = s.y + s.h;
            push = snap - body.y;
          } else {
            const snapUp = s.y + s.h;
            const pushUp = snapUp - body.y;
            const snapDown = s.y - body.h;
            const pushDown = body.y - snapDown;
            if (pushUp <= pushDown) { snap = snapUp; push = pushUp; }
            else { snap = snapDown; push = pushDown; }
          }
        }
        if (push < bestPush) {
          bestPush = push;
          bestSnap = snap;
          if (axis === 'y' && dir > 0) landedCandidate = s.id;
        }
      }
      if (bestPush === Infinity) break;
      if (axis === 'x') {
        body.x = bestSnap;
        out.hitWall = dir !== 0 ? dir : (bestSnap > body.x ? 1 : -1);
      } else {
        body.y = bestSnap;
        if (dir > 0) {
          out.hitFloor = true;
          out.landedId = landedCandidate;
        } else if (dir < 0) {
          out.hitCeiling = true;
        }
      }
    }
  }
  if (zeroVelocity) {
    if (axis === 'x' && out.hitWall) body.vx = 0;
    if (axis === 'y' && (out.hitFloor || out.hitCeiling)) body.vy = 0;
  }
  return out;
}

/**
 * 把 body 沿 X+Y 推进（vx*dt, vy*dt），按顺序解算 X/Y。落地时记录 landedId 用于下一帧 ride。
 */
export function moveAndCollide(
  body: Body,
  solids: Solid[],
  dt: number,
  selfId: string,
  selfGroup: number | undefined
): CollisionResult {
  const out: CollisionResult = { hitWall: 0, hitCeiling: false, hitFloor: false, landedId: null };
  if (body.vx !== 0) {
    const r = resolveAxis(body, body.vx * dt, solids, selfId, selfGroup, 'x', true);
    out.hitWall = r.hitWall ?? 0;
  }
  if (body.vy !== 0) {
    const r = resolveAxis(body, body.vy * dt, solids, selfId, selfGroup, 'y', true);
    out.hitFloor = r.hitFloor ?? false;
    out.hitCeiling = r.hitCeiling ?? false;
    out.landedId = r.landedId ?? null;
  }
  body.onGround = out.hitFloor;
  if (out.hitFloor && out.landedId) body.ride = { id: out.landedId };
  else body.ride = null;
  return out;
}

/**
 * 把 body 按给定位移平移并解算重叠（不动速度）。
 * 用于移动平台在轴向位移后，将其上的骑乘者传送过去。
 */
export function applyCarry(
  body: Body,
  dx: number,
  dy: number,
  solids: Solid[],
  selfId: string,
  selfGroup: number | undefined
): void {
  if (dx !== 0) resolveAxis(body, dx, solids, selfId, selfGroup, 'x', false);
  if (dy !== 0) resolveAxis(body, dy, solids, selfId, selfGroup, 'y', false);
}
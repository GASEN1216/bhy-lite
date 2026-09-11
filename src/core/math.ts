/**
 * 数值工具 —— AABB & 几何相关。
 * 不依赖任何第三方库；纯函数便于在 Node 单测里运行。
 */

import type { AABB } from './types';

/** 数值钳制 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 线性插值 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 朝目标方向逼近，常用于相机平滑 */
export function approach(current: number, target: number, maxStep: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxStep) return target;
  return current + Math.sign(d) * maxStep;
}

/** 测试两 AABB 是否相交 */
export function overlaps(a: AABB, b: AABB): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** 两 AABB 的最小平移向量（MTV）。用于碰撞解算。 */
export function intersectMTV(
  a: AABB,
  b: AABB
): { mtvX: number; mtvY: number; normalX: -1 | 0 | 1; normalY: -1 | 0 | 1 } | null {
  if (!overlaps(a, b)) return null;
  // 把 a 推出去所需位移（正值表示该方向上的距离）：
  //   向左：new a.x = b.x - a.w → 位移 = -(a.x + a.w - b.x)
  //   向右：new a.x = b.x + b.w → 位移 = +(b.x + b.w - a.x)
  //   向上：new a.y = b.y - a.h → 位移 = -(a.y + a.h - b.y)
  //   向下：new a.y = b.y + b.h → 位移 = +(b.y + b.h - a.y)
  const pushLeft = a.x + a.w - b.x;
  const pushRight = b.x + b.w - a.x;
  const pushUp = a.y + a.h - b.y;
  const pushDown = b.y + b.h - a.y;

  const candidates: { axis: 'x' | 'y'; v: number; mag: number }[] = [];
  if (pushLeft >= 0) candidates.push({ axis: 'x', v: -pushLeft, mag: pushLeft });
  if (pushRight >= 0) candidates.push({ axis: 'x', v: +pushRight, mag: pushRight });
  if (pushUp >= 0) candidates.push({ axis: 'y', v: -pushUp, mag: pushUp });
  if (pushDown >= 0) candidates.push({ axis: 'y', v: +pushDown, mag: pushDown });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.mag - b.mag);
  const best = candidates[0];
  if (best.axis === 'x') {
    return { mtvX: best.v, mtvY: 0, normalX: best.v < 0 ? 1 : -1, normalY: 0 };
  }
  return { mtvX: 0, mtvY: best.v, normalX: 0, normalY: best.v < 0 ? 1 : -1 };
}

/** 把浮点误差限制在 0 上 */
export function snapUp(v: number, eps = 0.001): number {
  return Math.abs(v) < eps ? 0 : v;
}

/** 在 [min,max) 区间内环绕 */
export function wrap(value: number, min: number, max: number): number {
  const r = max - min;
  return min + ((((value - min) % r) + r) % r);
}
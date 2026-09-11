import { describe, expect, it } from 'vitest';
import { clamp, intersectMTV, lerp, overlaps, snapUp } from '../src/core/math';

describe('core/math', () => {
  it('clamp 限制在区间内', () => {
    expect(clamp(1, 0, 2)).toBe(1);
    expect(clamp(-1, 0, 2)).toBe(0);
    expect(clamp(3, 0, 2)).toBe(2);
  });

  it('lerp 线性插值', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(0, 10, 1)).toBe(10);
  });

  it('overlaps / intersectMTV 判定与方向', () => {
    const a = { x: 0, y: 0, w: 10, h: 10 };
    const b = { x: 5, y: 0, w: 10, h: 10 };
    expect(overlaps(a, b)).toBe(true);
    const mtv = intersectMTV(a, b)!;
    expect(mtv).not.toBeNull();
    // X 方向交叠 5，应该沿 X 推出
    expect(mtv.mtvY).toBe(0);
    expect(Math.abs(mtv.mtvX)).toBe(5);

    const c = { x: 4, y: 9, w: 10, h: 10 };
    const mtv2 = intersectMTV(a, c)!;
    expect(mtv2.mtvY).toBe(-1); // 推上去
    expect(mtv2.normalY).toBe(1);
  });

  it('snapUp 消除抖动', () => {
    expect(snapUp(0.0001)).toBe(0);
    expect(snapUp(-0.0001)).toBe(0);
    expect(snapUp(0.5)).toBe(0.5);
  });
});
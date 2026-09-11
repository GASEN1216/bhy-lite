import { describe, expect, it } from 'vitest';
import { applyCarry, moveAndCollide, type Solid } from '../src/engine/physics';
import type { Body } from '../src/engine/physics';

function body(x = 0, y = 0, vx = 0, vy = 0, w = 16, h = 16): Body {
  return { x, y, w, h, vx, vy, onGround: false, ride: null };
}

describe('engine/physics', () => {
  it('角色被单块地板挡住后会落地、不再下落', () => {
    const floor: Solid = { id: 'floor', kind: 'tile', x: -100, y: 50, w: 200, h: 5 };
    const b = body(0, 40, 0, 100, 16, 16);
    moveAndCollide(b, [floor], 1 / 60, 'me', undefined);
    expect(b.vy).toBe(0);
    expect(b.y).toBeLessThan(40);
    expect(b.onGround).toBe(true);
    expect(b.ride?.id).toBe('floor');
  });

  it('撞墙后水平速度归零', () => {
    const wall: Solid = { id: 'wall', kind: 'tile', x: 50, y: 0, w: 5, h: 100 };
    const b = body(30, 0, 5000, 0, 16, 16);
    const res = moveAndCollide(b, [wall], 1 / 60, 'me', undefined);
    expect(b.vx).toBe(0);
    expect(res.hitWall).toBe(1);
  });

  it('两组 group 不同会互相碰撞；相同则忽略', () => {
    const friend: Solid = { id: 'friend', kind: 'character', x: 20, y: 0, w: 8, h: 8, group: 11 };
    const enemy: Solid = { id: 'enemy', kind: 'character', x: 20, y: 0, w: 8, h: 8, group: 22 };
    const me_body = body(0, 0, 5000, 0, 8, 8);
    moveAndCollide(me_body, [friend, enemy], 1 / 60, 'me', 11);
    // me 应该被推回到 enemy 的左沿（me 的右沿 = enemy.x），即 me.x = 20 - 8 = 12
    expect(me_body.x).toBeLessThanOrEqual(13);
    expect(me_body.x).toBeGreaterThan(0);
  });

  it('applyCarry 沿 X 推送并解析碰撞（不动速度）', () => {
    const wall: Solid = { id: 'wall', kind: 'tile', x: 30, y: 0, w: 5, h: 50 };
    const b = body(0, 0, 0, 0, 8, 8);
    applyCarry(b, 100, 0, [wall], 'me', undefined);
    expect(b.x).toBe(22);
    expect(b.vx).toBe(0); // 速度未被改
  });

  it('大速度下通过子步不会穿墙', () => {
    const wall: Solid = { id: 'wall', kind: 'tile', x: 30, y: 0, w: 1, h: 50 };
    const b = body(0, 0, 5000, 0, 8, 8); // 5k px/s × 1/60 = 83 px
    moveAndCollide(b, [wall], 1 / 60, 'me', undefined);
    expect(b.x).toBeLessThanOrEqual(30);
  });
});
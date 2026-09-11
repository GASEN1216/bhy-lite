/**
 * 世界仿真 step —— 一帧（fixed dt）把整个世界推进一次。
 *
 * 步骤：
 *   0. 死亡 / 暂停 / 通关 状态处理
 *   1. 触发器（拉杆 / 按钮）更新 active
 *   2. 移动平台推进 + 传送骑乘者
 *   3. 箱子：重力 / 物理 / 危险 / 复活
 *   4. 角色：输入 → 跳跃 → 重力 → 物理 → 危险 → 宝石 → 门
 *   5. 终点门动画
 *   6. 通关检测
 *   7. 摄像机
 */

import { CHARACTER, PHYSICS, TILE_SIZE, TILES } from '../core/constants';
import type {
  BoxState,
  GameEvent,
  GameState,
  PlayerState,
  PlatformState,
} from '../core/types';
import type { Input } from '../engine/input';
import { applyCarry, moveAndCollide, type Solid } from '../engine/physics';
import { updateCamera } from '../engine/camera';
import { clamp } from '../core/math';

export interface WorldHooks {
  /** 播放音效（名字见 core/constants.ts ASSETS.audio 的 key） */
  playSfx?: (name: string) => void;
  /** 任意游戏事件，UI 可订阅 */
  onEvent?: (e: GameEvent) => void;
}

/** 一帧推进。dt 应为常量（见 engine/loop.FIXED_DT） */
export function stepWorld(state: GameState, input: Input, hooks: WorldHooks, dt: number): void {
  if (state.status === 'paused' || state.status === 'won') return;
  if (state.status === 'dead') {
    state.deathTimer += dt;
    for (const p of state.players) {
      p.vx = 0;
      p.vy = 0;
    }
    if (state.deathTimer >= 0.85) {
      respawn(state);
      state.status = 'playing';
      state.deathTimer = 0;
      hooks.onEvent?.({ type: 'step', payload: 'respawn' });
    }
    return;
  }

  state.elapsed += dt;

  // 1. 触发器 → 2. 闸门 → 3. 平台（顺序重要：平台解算要用到最新的闸门状态）
  const triggerActive = updateTriggers(state, hooks);
  updateGates(state, triggerActive);
  updatePlatforms(state, hooks, triggerActive, dt);
  // 4. 箱子
  for (const b of state.boxes) stepBox(b, state, hooks, dt);
  // 4. 角色
  for (const p of state.players) stepPlayer(p, state, input, hooks, dt);
  // 5. 终点门动画
  updateDoors(state, hooks, dt);
  // 6. 通关
  if (state.status === 'playing' && state.players[0].atDoor && state.players[1].atDoor) {
    state.status = 'won';
    state.wonAt = state.elapsed;
    hooks.playSfx?.('win');
    hooks.onEvent?.({ type: 'win', payload: { elapsed: state.elapsed } });
  }
  // 7. 摄像机
  updateCamera(
    state.camera,
    state.players,
    state.level.width * TILE_SIZE,
    state.level.height * TILE_SIZE,
    dt
  );
}

/* ------------------------------- 触发器 ------------------------------- */

function updateTriggers(state: GameState, hooks: WorldHooks): Map<string, boolean> {
  const occ = (rect: { x: number; y: number; w: number; h: number }): boolean => {
    for (const p of state.players) {
      if (p.dead) continue;
      if (rectOverlap(p, rect)) return true;
    }
    for (const b of state.boxes) {
      if (b.respawnIn > 0) continue;
      if (rectOverlap(b, rect)) return true;
    }
    return false;
  };
  for (const t of state.triggers) {
    const rect = {
      x: t.def.col * TILE_SIZE,
      y: t.def.row * TILE_SIZE,
      w: TILE_SIZE,
      h: TILE_SIZE,
    };
    const overlap = occ(rect);
    if (t.def.kind === 'lever') {
      if (!t.prevOverlap && overlap) {
        t.active = !t.active;
        hooks.playSfx?.('lever');
        hooks.onEvent?.({
          type: 'lever',
          payload: { id: t.def.id, active: t.active, targets: t.def.targets },
        });
      }
    } else {
      const wasActive = t.active;
      t.active = overlap;
      if (t.active !== wasActive) {
        hooks.playSfx?.('lever');
        hooks.onEvent?.({
          type: 'button',
          payload: { id: t.def.id, active: t.active, targets: t.def.targets },
        });
      }
    }
    t.prevOverlap = overlap;
  }

  const active = new Map<string, boolean>();
  for (const t of state.triggers) active.set(t.def.id, t.active);
  return active;
}

/* ------------------------------- 闸门 ------------------------------- */

/**
 * 闸门固体状态：
 *   默认（invert 未开）：任一关联触发器激活 → 闸门打开（不固体）
 *   invert = true     ：任一关联触发器激活 → 闸门关闭（固体）
 */
function updateGates(state: GameState, triggerActive: Map<string, boolean>): void {
  for (const g of state.gates) {
    const anyActive = g.def.targets.some((id) => triggerActive.get(id));
    g.solid = g.def.invert ? anyActive : !anyActive;
  }
}

/* ------------------------------- 平台 ------------------------------- */

function updatePlatforms(
  state: GameState,
  hooks: WorldHooks,
  triggerActive: Map<string, boolean>,
  dt: number
): void {
  for (const p of state.platforms) {
    const prevActive = p.active;
    if (p.def.mode === 'auto') {
      p.active = true;
    } else {
      p.active = p.def.targets.some((id) => triggerActive.get(id));
    }
    if (p.active !== prevActive) {
      hooks.onEvent?.({
        type: 'platform',
        payload: { id: p.def.id, active: p.active },
      });
    }

    if (p.active) {
      // 半周期 = |distance|*TS / speed
      const halfPeriod = (Math.abs(p.def.distance) * TILE_SIZE) / Math.max(1, p.def.speed);
      p.phase += dt / halfPeriod;
      // sin 0→1→0 (phase 0→π→2π)
      const sinT = (Math.sin(p.phase * Math.PI) + 1) / 2;
      const sign = Math.sign(p.def.distance) || 1;
      const off = sinT * Math.abs(p.def.distance) * TILE_SIZE * sign;
      if (p.def.axis === 'x') {
        p.x = p.def.col * TILE_SIZE + off;
        p.y = p.def.row * TILE_SIZE;
      } else {
        p.x = p.def.col * TILE_SIZE;
        p.y = p.def.row * TILE_SIZE + off;
      }
    }

    const dx = p.x - p.lastX;
    const dy = p.y - p.lastY;
    if (dx !== 0 || dy !== 0) {
      // 用于解算骑乘者：剔除其它平台（仅本平台 + 静态）
      const solids: Solid[] = [];
      for (const s of state.solids) solids.push({ id: `s:${s.x}_${s.y}`, kind: 'tile', ...s });
      for (const g of state.gates) {
        if (g.solid) solids.push({ id: `g:${g.def.id}`, kind: 'gate', x: g.x, y: g.y, w: g.w, h: g.h });
      }
      solids.push(platformToSolid(p));
      for (const pl of state.players) {
        if (pl.dead) continue;
        if (pl.ride && pl.ride.id === `pl:${p.def.id}` && pl.onGround) {
          applyCarry(toBodyLike(pl), dx, dy, solids, `pl:${p.def.id}`, undefined);
        }
      }
      for (const b of state.boxes) {
        if (b.respawnIn > 0) continue;
        if (b.ride && b.ride.id === `pl:${p.def.id}` && b.onGround) {
          applyCarry(toBodyLike(b), dx, dy, solids, `pl:${p.def.id}`, undefined);
        }
      }
    }
    p.lastX = p.x;
    p.lastY = p.y;
  }
}

/* ------------------------------- 箱子 ------------------------------- */

function stepBox(b: BoxState, state: GameState, hooks: WorldHooks, dt: number): void {
  if (b.respawnIn > 0) {
    b.respawnIn -= dt;
    b.vx = 0;
    b.vy = 0;
    if (b.respawnIn <= 0) {
      b.x = b.initial.x;
      b.y = b.initial.y;
      b.vx = 0;
      b.vy = 0;
      b.onGround = false;
      b.ride = null;
    }
    return;
  }

  b.vy = clamp(b.vy + PHYSICS.gravity * dt, -PHYSICS.maxFallSpeed, PHYSICS.maxFallSpeed);

  const solids = collectBoxSolids(state, b);
  const body = toBodyLike(b);
  moveAndCollide(body, solids, dt, `bx:${b.id}`, undefined);
  b.x = body.x;
  b.y = body.y;
  b.vx = body.vx;
  b.vy = body.vy;
  b.onGround = body.onGround;
  b.ride = body.ride;

  // 推箱 sfx：横向撞击
  for (const s of solids) {
    if (s.kind === 'tile' || s.kind === 'gate' || s.kind === 'box') {
      if (rectOverlap(b, s) && Math.abs(b.vx) > 1) {
        hooks.playSfx?.('push');
        break;
      }
    }
  }

  // 危险
  for (const hz of state.hazards) {
    if (rectOverlap(b, hz)) {
      b.respawnIn = 1.4;
      b.vx = 0;
      b.vy = -200;
      break;
    }
  }
}

/* ------------------------------- 角色 ------------------------------- */

function stepPlayer(
  p: PlayerState,
  state: GameState,
  input: Input,
  hooks: WorldHooks,
  dt: number
): void {
  if (p.dead) return;

  const left = input.isHeld(p.kind === CHARACTER.FIREBOY ? 'fire-left' : 'water-left');
  const right = input.isHeld(p.kind === CHARACTER.FIREBOY ? 'fire-right' : 'water-right');
  const jumpPressed = input.isPressed(p.kind === CHARACTER.FIREBOY ? 'fire-jump' : 'water-jump');
  const jumpHeld = input.isHeld(p.kind === CHARACTER.FIREBOY ? 'fire-jump' : 'water-jump');

  const targetDir = (left ? -1 : 0) + (right ? 1 : 0);
  if (targetDir !== 0) p.facing = targetDir as -1 | 1;
  const targetVx = targetDir * PHYSICS.moveSpeed;
  if (p.onGround) {
    p.vx = targetVx;
  } else {
    p.vx = approach(p.vx, targetVx, PHYSICS.airAccel * dt);
  }

  // 跳跃（coyote + buffer）
  if (jumpPressed) p.bufferLeft = PHYSICS.jumpBufferTime;
  if (p.onGround) p.coyoteLeft = PHYSICS.coyoteTime;
  else p.coyoteLeft = Math.max(0, p.coyoteLeft - dt);

  if (p.bufferLeft > 0 && p.coyoteLeft > 0) {
    p.vy = PHYSICS.jumpVelocity;
    p.jumpedFrom = !p.onGround ? 'coyote' : 'normal';
    p.bufferLeft = 0;
    p.coyoteLeft = 0;
    hooks.playSfx?.('jump');
  }
  if (!jumpHeld && p.vy < 0) {
    p.vy = clamp(p.vy + PHYSICS.jumpCutGravity * dt, -PHYSICS.maxFallSpeed, Infinity);
  }
  p.bufferLeft = Math.max(0, p.bufferLeft - dt);

  // 重力
  p.vy = clamp(p.vy + PHYSICS.gravity * dt, -PHYSICS.maxFallSpeed, PHYSICS.maxFallSpeed);

  // 物理
  const solids = collectPlayerSolids(state, p);
  const body = toBodyLike(p);
  const res = moveAndCollide(body, solids, dt, `pl:${p.kind}`, p.kind === 'fire' ? 11 : 22);
  p.x = body.x;
  p.y = body.y;
  p.vx = body.vx;
  p.vy = body.vy;
  p.onGround = body.onGround;
  p.ride = body.ride;
  if (res.hitWall !== 0) p.wall = res.hitWall;
  if (res.hitCeiling) p.vy = Math.max(0, p.vy);

  // 推箱：横向撞到箱子时，把它按 pushSpeed 推走（撞墙则推不动，角色自然被挡住）
  if (res.hitWall !== 0) pushBoxes(p, state, hooks, res.hitWall, dt);

  // 危险
  for (const hz of state.hazards) {
    if (!rectOverlap(p, hz)) continue;
    const dies =
      hz.type === TILES.ACID ||
      (hz.type === TILES.FIRE && p.kind === 'water') ||
      (hz.type === TILES.WATER && p.kind === 'fire');
    if (dies) {
      killPlayer(p, state, hooks);
      return;
    }
  }

  // 宝石
  for (const g of state.gems) {
    if (g.collected) continue;
    if (g.kind !== p.kind) continue;
    if (rectOverlap(p, g)) {
      g.collected = true;
      p.gems += 1;
      hooks.playSfx?.('gem');
      hooks.onEvent?.({ type: 'gem', payload: { kind: p.kind, total: p.gems } });
    }
  }

  // 门
  const myDoor = state.doors.find((d) => d.kind === p.kind)!;
  p.atDoor = rectOverlap(p, myDoor);
}

/**
 * 把角色正在顶的箱子沿 dir 方向推 pushSpeed*dt 像素。
 * 箱子自身再做一次碰撞解算 —— 撞墙/撞另一个箱子时推不动，角色也就被挡住了。
 */
function pushBoxes(p: PlayerState, state: GameState, hooks: WorldHooks, dir: -1 | 1, dt: number): void {
  for (const b of state.boxes) {
    if (b.respawnIn > 0) continue;
    // 垂直方向必须真的重叠（不能头顶着箱子把下面顶走）
    if (p.y + p.h <= b.y + 2 || p.y >= b.y + b.h - 2) continue;
    const touchingRight = Math.abs(p.x + p.w - b.x) <= 2; // 箱子在角色右侧
    const touchingLeft = Math.abs(b.x + b.w - p.x) <= 2; // 箱子在角色左侧
    if (dir === 1 && touchingRight) {
      moveBoxBy(b, PHYSICS.pushSpeed * dt, state, hooks);
    } else if (dir === -1 && touchingLeft) {
      moveBoxBy(b, -PHYSICS.pushSpeed * dt, state, hooks);
    }
  }
}

/** 箱子被推时的平移 + 解算（不含角色，避免被角色反向卡住） */
function moveBoxBy(b: BoxState, dx: number, state: GameState, hooks: WorldHooks): void {
  if (dx === 0) return;
  const before = b.x;
  const solids = collectBoxSolids(state, b);
  const body = toBodyLike(b);
  applyCarry(body, dx, 0, solids, `bx:${b.id}`, undefined);
  b.x = body.x;
  if (b.x !== before) {
    hooks.playSfx?.('push');
  }
}

function killPlayer(p: PlayerState, state: GameState, hooks: WorldHooks): void {
  p.dead = true;
  p.vx = 0;
  p.vy = -260;
  state.status = 'dead';
  state.deathTimer = 0;
  hooks.playSfx?.('death');
  hooks.onEvent?.({ type: 'hazard', payload: { kind: p.kind } });
}

function respawn(state: GameState): void {
  for (const p of state.players) {
    p.dead = false;
    const sp = p.kind === 'fire' ? state.level.spawns.fire : state.level.spawns.water;
    p.x = sp.x * TILE_SIZE + (TILE_SIZE - PHYSICS.charW) / 2;
    p.y = (sp.y + 1) * TILE_SIZE - PHYSICS.charH;
    p.vx = 0;
    p.vy = 0;
    p.onGround = false;
    p.ride = null;
    p.atDoor = false;
    p.gems = 0; // 重生清宝石，需要重新收集
  }
  for (const b of state.boxes) {
    b.x = b.initial.x;
    b.y = b.initial.y;
    b.vx = 0;
    b.vy = 0;
    b.onGround = false;
    b.ride = null;
    b.respawnIn = -1;
  }
  // 宝石复活
  for (const g of state.gems) g.collected = false;
  // 拉杆状态保留（机关已永久生效），按钮清空
  for (const t of state.triggers) {
    if (t.def.kind === 'button') {
      t.active = false;
      t.prevOverlap = false;
    }
  }
}

/* ------------------------------- 终点门 ------------------------------- */

function updateDoors(state: GameState, hooks: WorldHooks, dt: number): void {
  for (const d of state.doors) {
    const at = state.players.some((p) => !p.dead && p.kind === d.kind && p.atDoor);
    if (at && !d.open) hooks.playSfx?.('door');
    d.open = at;
    d.openAnim = clamp(d.openAnim + (at ? dt * 3 : -dt * 2), 0, 1);
  }
}

/* ------------------------------- 工具 ------------------------------- */

function rectOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function approach(cur: number, target: number, max: number): number {
  if (Math.abs(target - cur) <= max) return target;
  return cur + Math.sign(target - cur) * max;
}

function toBodyLike(b: { x: number; y: number; vx: number; vy: number; onGround: boolean; ride: { id: string } | null; w: number; h: number }): import('../engine/physics').Body {
  return {
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    vx: b.vx,
    vy: b.vy,
    onGround: b.onGround,
    ride: b.ride,
  };
}

function collectStaticSolids(state: GameState, includePlatforms: boolean): Solid[] {
  const out: Solid[] = [];
  for (const s of state.solids) {
    out.push({ id: `s:${s.x}_${s.y}`, kind: 'tile', x: s.x, y: s.y, w: s.w, h: s.h });
  }
  for (const g of state.gates) {
    if (g.solid) out.push({ id: `g:${g.def.id}`, kind: 'gate', x: g.x, y: g.y, w: g.w, h: g.h });
  }
  if (includePlatforms) {
    for (const p of state.platforms) {
      out.push({ ...platformToSolid(p) });
    }
  }
  return out;
}

function collectBoxSolids(state: GameState, self: BoxState): Solid[] {
  const out = collectStaticSolids(state, true);
  for (const b of state.boxes) {
    if (b === self || b.respawnIn > 0) continue;
    out.push({ id: `bx:${b.id}`, kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h });
  }
  return out;
}

function collectPlayerSolids(state: GameState, self: PlayerState): Solid[] {
  const out = collectStaticSolids(state, true);
  for (const b of state.boxes) {
    if (b.respawnIn > 0) continue;
    out.push({ id: `bx:${b.id}`, kind: 'box', x: b.x, y: b.y, w: b.w, h: b.h });
  }
  for (const other of state.players) {
    if (other === self || other.dead) continue;
    out.push({
      id: `pl:${other.kind}`,
      kind: 'character',
      x: other.x,
      y: other.y,
      w: PHYSICS.charW,
      h: PHYSICS.charH,
      group: other.kind === 'fire' ? 11 : 22,
    });
  }
  return out;
}

function platformToSolid(p: PlatformState): Solid {
  return {
    id: `pl:${p.def.id}`,
    kind: 'platform',
    x: p.x,
    y: p.y,
    w: p.def.w * TILE_SIZE,
    h: p.def.h * TILE_SIZE,
  };
}
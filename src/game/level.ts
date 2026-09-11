/**
 * 关卡数据 → 运行时世界状态 的转换。
 * 同时提供一个 tileToId 映射，方便 ASCII 图直接转换为静态碰撞表。
 */

import { TILE_SIZE, TILES } from '../core/constants';
import type {
  BoxDef,
  DoorDef,
  GameState,
  GateDef,
  GemDef,
  LevelDef,
  MovingPlatformDef,
  PlayerState,
  TileId,
  TileMap,
  TriggerDef,
} from '../core/types';

/** 字符 -> tile id 映射（不含实体：实体单独看） */
export function tileFor(ch: string): TileId {
  switch (ch) {
    case '#': return TILES.STONE;
    case ',': return TILES.DIRT;
    case 'f': return TILES.FIRE;
    case 'w': return TILES.WATER;
    case 'a': return TILES.ACID;
    case 'M': return TILES.METAL;
    default: return TILES.AIR;
  }
}

/** 是否是某种危险地形 */
export function isHazardTile(t: TileId): boolean {
  return t === TILES.FIRE || t === TILES.WATER || t === TILES.ACID;
}

/** 构造一个完整 GameState（不包含 platforms/gates/triggers 状态的物理坐标） */
export function createGameState(def: LevelDef): GameState {
  const grid = buildTileGrid(def);

  // ---- 玩家 ----
  const fire: PlayerState = makePlayer('fire', def.spawns.fire);
  const water: PlayerState = makePlayer('water', def.spawns.water);

  // ---- 宝石 ----
  const gemStates = def.gems.map((g) => ({
    col: g.col,
    row: g.row,
    kind: g.kind,
    x: g.col * TILE_SIZE + (TILE_SIZE - 16) / 2,
    y: g.row * TILE_SIZE + (TILE_SIZE - 16) / 2,
    w: 16,
    h: 16,
    collected: false,
  }));

  // ---- 终点门 ----
  const doors: GameState['doors'] = [
    doorFrom(def.doors.fire),
    doorFrom(def.doors.water),
  ];

  // ---- 移动平台 ----
  const platforms = def.movingPlatforms.map((p) => {
    const x = p.col * TILE_SIZE;
    const y = p.row * TILE_SIZE;
    return {
      def: p,
      x,
      y,
      phase: p.phase ?? 0,
      active: p.mode === 'auto',
      toggledSinceUpdate: false,
      lastX: x,
      lastY: y,
    };
  });

  // ---- 闸门 ----
  const gates = def.gates.map((g) => {
    const x = g.col * TILE_SIZE;
    const y = g.row * TILE_SIZE;
    return {
      def: g,
      x,
      y,
      w: g.w * TILE_SIZE,
      h: g.h * TILE_SIZE,
      solid: !invertInitial(g),
    };
  });

  // ---- 触发器 ----
  const triggers = def.triggers.map((t) => ({
    def: t,
    active: !!t.initial,
    prevOverlap: false,
  }));

  // ---- 箱子 ----
  const boxes = def.boxes.map((b, i) => ({
    id: i + 1,
    x: b.col * TILE_SIZE + (TILE_SIZE - 20) / 2,
    y: b.row * TILE_SIZE + (TILE_SIZE - 20) / 2,
    vx: 0,
    vy: 0,
    w: 20,
    h: 20,
    onGround: false,
    ride: null,
    respawnIn: -1,
    initial: {
      x: b.col * TILE_SIZE + (TILE_SIZE - 20) / 2,
      y: b.row * TILE_SIZE + (TILE_SIZE - 20) / 2,
    },
  }));

  const cam = {
    x: def.width * TILE_SIZE / 2,
    y: def.height * TILE_SIZE / 2,
    zoom: 1,
  };

  return {
    level: def,
    players: [fire, water],
    boxes,
    platforms,
    gates,
    triggers,
    gems: gemStates,
    doors,
    hazards: buildHazardRects(grid),
    solids: buildStaticSolids(grid),
    camera: cam,
    elapsed: 0,
    deathTimer: 0,
    status: 'playing',
    wonAt: null,
  };
}

function invertInitial(g: GateDef): boolean {
  if (g.invert === undefined) return false;
  // 当 invert 时：trigger 激活 → 不固体；trigger 未激活 → 固体
  return !!g.invert;
}

/**
 * 出生点 / 门 / 宝石 / 箱子 的字符放在其"所在空气格"。
 * 角色的脚底 = (row + 1) * TILE_SIZE，即站在 row+1 那格固体之上。
 */
function makePlayer(kind: PlayerState['kind'], tile: { x: number; y: number }): PlayerState {
  const [col, row] = [tile.x, tile.y];
  const x = col * TILE_SIZE + (TILE_SIZE - 18) / 2;
  const y = (row + 1) * TILE_SIZE - 26;
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    w: 18,
    h: 26,
    facing: kind === 'fire' ? 1 : -1,
    onGround: false,
    wall: 0,
    jumpedFrom: null,
    coyoteLeft: 0,
    bufferLeft: 0,
    jumpHeld: false,
    dead: false,
    gems: 0,
    atDoor: false,
    ride: null,
  };
}

function doorFrom(d: DoorDef) {
  // 门为 32x48，左下角 = col,row (ground)；row 为站立格子上方一格
  const x = d.col * TILE_SIZE;
  const y = (d.row + 1) * TILE_SIZE - 48;
  return {
    kind: d.kind,
    x,
    y,
    w: 32,
    h: 48,
    open: false,
    openAnim: 0,
  };
}

/**
 * 把 ASCII 图转为静态 tile 表。
 * 返回的是一个 row-major 的 TileId[][]（行为 y, 列为 x）。
 */
export function buildTileGrid(def: LevelDef): TileId[][] {
  const rows = def.height;
  const cols = def.width;
  const grid: TileId[][] = Array.from({ length: rows }, () => new Array(cols).fill(TILES.AIR));
  for (let y = 0; y < def.map.length && y < rows; y++) {
    const line = def.map[y];
    for (let x = 0; x < line.length && x < cols; x++) {
      grid[y][x] = tileFor(line[x]);
    }
  }
  return grid;
}

/** 静态固体矩形（仅返回 STONE / DIRT / METAL） */
export function buildStaticSolids(grid: TileId[][]): { x: number; y: number; w: number; h: number; type: TileId }[] {
  const out: { x: number; y: number; w: number; h: number; type: TileId }[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const t = grid[y][x];
      if (t === TILES.STONE || t === TILES.DIRT || t === TILES.METAL) {
        out.push({
          x: x * TILE_SIZE,
          y: y * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
          type: t,
        });
      }
    }
  }
  return out;
}

/** 仅返回液体格子的矩形（用于危险判定） */
export function buildHazardRects(grid: TileId[][]): { x: number; y: number; w: number; h: number; type: TileId }[] {
  const out: { x: number; y: number; w: number; h: number; type: TileId }[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      const t = grid[y][x];
      if (isHazardTile(t)) {
        out.push({
          x: x * TILE_SIZE,
          y: y * TILE_SIZE,
          w: TILE_SIZE,
          h: TILE_SIZE,
          type: t,
        });
      }
    }
  }
  return out;
}

/* ---------------------------- 校验 ---------------------------- */

/**
 * 检查关卡结构性错误，返回错误列表（空数组即通过）。
 * 仅为运行时诊断工具；关卡编辑器设计完成后应保证 0 错误。
 */
export function validateLevel(def: LevelDef): string[] {
  const errors: string[] = [];
  if (def.map.length !== def.height) errors.push(`map 行数(${def.map.length})与 height(${def.height})不一致`);
  for (let i = 0; i < def.map.length; i++) {
    if (def.map[i].length !== def.width)
      errors.push(`第 ${i} 行长度(${def.map[i].length})与 width(${def.width})不一致`);
  }
  if (!def.spawns.fire) errors.push('缺少火男出生点 F');
  if (!def.spawns.water) errors.push('缺少水女出生点 W');
  if (!def.doors.fire) errors.push('缺少火门 D');
  if (!def.doors.water) errors.push('缺少水门 d');
  // 重复 id
  const ids = new Set<string>();
  for (const t of def.triggers) ids.add(`trigger:${t.id}`);
  for (const p of def.movingPlatforms) ids.add(`platform:${p.id}`);
  for (const g of def.gates) ids.add(`gate:${g.id}`);
  const seen = new Set<string>();
  for (const k of ids) {
    if (seen.has(k)) errors.push(`重复 id: ${k}`);
    seen.add(k);
  }
  return errors;
}

export type { BoxDef, GemDef, DoorDef, TriggerDef, MovingPlatformDef, GateDef, TileMap };
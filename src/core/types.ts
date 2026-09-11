/**
 * 跨模块复用的领域类型。所有"逻辑数据"都集中在这里以便测试。
 */
import type { CHARACTER, TILES } from './constants';

export type CharacterKind = (typeof CHARACTER)[keyof typeof CHARACTER];

export type Vec2 = { x: number; y: number };

export type Rect = { x: number; y: number; w: number; h: number };

export interface AABB extends Rect {
  /** 用于碰撞分类 / 过滤；同 group 跳过碰撞 */
  group?: number;
}

/* ----------------------------- 关卡数据 ------------------------------- */

export type TileId = (typeof TILES)[keyof typeof TILES];

/** ASCII 关卡图：每行等长字符串，字符 -> 图块或实体。 */
export type TileMap = readonly string[];

export interface TriggerDef {
  id: string;
  kind: 'lever' | 'button';
  /** 锚点（左下角）格坐标，宽度 1，高 1 */
  col: number;
  row: number;
  /** 受控目标的 id 列表 */
  targets: string[];
  /** 是否初始激活（默认 false） */
  initial?: boolean;
}

export interface MovingPlatformDef {
  id: string;
  /** 左下角（tile） */
  col: number;
  row: number;
  /** tile 为单位 */
  w: number;
  h: number;
  axis: 'x' | 'y';
  /** 移动距离（tile，可正可负） */
  distance: number;
  /** 移动速度（px/s） */
  speed: number;
  /** 'auto' 总是运动；'trigger' 仅在任一受控 trigger 当前激活时运动 */
  mode: 'auto' | 'trigger';
  /** 受控 trigger id 列表（仅 mode='trigger' 时用） */
  targets: string[];
  /** 起始相位 0..1（可选） */
  phase?: number;
}

export interface GateDef {
  id: string;
  /** 左下角（tile） */
  col: number;
  row: number;
  w: number;
  h: number;
  /** 受控 trigger id 列表 */
  targets: string[];
  /** true：trigger 激活时门变为可通过（默认 false：激活时门=固体） */
  invert?: boolean;
}

export interface GemDef {
  col: number;
  row: number;
  kind: CharacterKind;
}

export interface DoorDef {
  col: number;
  row: number;
  kind: CharacterKind;
}

export interface BoxDef {
  col: number;
  row: number;
}

export interface LevelDef {
  id: number;
  name: string;
  hint: string;
  width: number; // tile
  height: number; // tile
  map: TileMap;
  spawns: { fire: Vec2; water: Vec2 }; // tile coord (col,row)
  doors: { fire: DoorDef; water: DoorDef };
  gems: readonly GemDef[];
  boxes: readonly BoxDef[];
  triggers: readonly TriggerDef[];
  movingPlatforms: readonly MovingPlatformDef[];
  gates: readonly GateDef[];
  /** 用时 <= 此值 且 拿到全部宝石 → 3 星；仅通关 → 1 星（秒） */
  twoStarTime: number;
}

/* ----------------------------- 运行时状态 ------------------------------- */

export interface PlayerState {
  kind: CharacterKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  /** 朝向 -1 / 1，仅影响渲染 */
  facing: -1 | 1;
  /** 是否落地 */
  onGround: boolean;
  /** 触墙方向（-1/0/1），用于将来拓展 */
  wall: -1 | 0 | 1;
  /** 跳跃相关 */
  jumpedFrom: 'coyote' | 'buffer' | 'normal' | null;
  coyoteLeft: number;
  bufferLeft: number;
  jumpHeld: boolean;
  dead: boolean;
  /** 收集到的宝石数 */
  gems: number;
  /** 是否到达终点门 */
  atDoor: boolean;
  /** 当前骑乘的实体 id；null=在地面。用于在物理步之间移动人物 */
  ride: { id: string } | null;
}

export interface BoxState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  ride: { id: string } | null;
  /** 落水销毁用：-1 表示稳定 */
  respawnIn: number;
  initial: { x: number; y: number };
}

export interface PlatformState {
  def: MovingPlatformDef;
  /** 左下角（px） */
  x: number;
  y: number;
  /** 当前相位 0..1（auto 用） */
  phase: number;
  /** 受控 trigger 中是否有任意当前激活 */
  active: boolean;
  /** 已激活标记，触发过 toggle 事件 */
  toggledSinceUpdate: boolean;
  lastX: number;
  lastY: number;
}

export interface GateState {
  def: GateDef;
  /** 左下角（px） */
  x: number;
  y: number;
  w: number;
  h: number;
  /** 当前是否对玩家构成固体（true=不可穿过） */
  solid: boolean;
}

export interface TriggerState {
  def: TriggerDef;
  /** 当前是否激活（lever: 翻转后保持；button: 按下保持） */
  active: boolean;
  /** 玩家或箱子进入的上一帧边缘检测 */
  prevOverlap: boolean;
}

export interface GemState {
  col: number;
  row: number;
  kind: CharacterKind;
  x: number;
  y: number;
  w: number;
  h: number;
  collected: boolean;
}

export interface DoorState {
  kind: CharacterKind;
  x: number;
  y: number;
  w: number;
  h: number;
  open: boolean;
  openAnim: number; // 0..1 平滑动画
}

export interface GameState {
  level: LevelDef;
  players: [PlayerState, PlayerState];
  boxes: BoxState[];
  platforms: PlatformState[];
  gates: GateState[];
  triggers: TriggerState[];
  gems: GemState[];
  doors: [DoorState, DoorState];
  hazards: { x: number; y: number; w: number; h: number; type: TileId }[];
  solids: { x: number; y: number; w: number; h: number; type: TileId }[];
  camera: { x: number; y: number; zoom: number };
  /** 倒计时：0 表示未开始 */
  elapsed: number;
  /** 死亡后到复活的剩余时间（秒） */
  deathTimer: number;
  status: 'playing' | 'paused' | 'won' | 'dead';
  wonAt: number | null;
}

export interface GameEvent {
  type:
    | 'gem'
    | 'hazard'
    | 'jump'
    | 'lever'
    | 'button'
    | 'platform'
    | 'door_open'
    | 'win'
    | 'step';
  payload?: unknown;
}
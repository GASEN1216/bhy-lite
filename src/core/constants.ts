/**
 * 全局常量 —— 调参与资源路径的单一入口。
 * 在单元测试里也可被直接 import。
 */

/* ----------------------------- 资源路径 ------------------------------- */

/**
 * Vite 的 BASE_URL：
 *  - 本地 dev / preview：'/'
 *  - GitHub Pages 构建：'/<repo>/'（由 vite.config.ts 推导，见那里注释）
 * 所有资源路径都必须拼接它，否则部署到子路径后 404。
 */
const BASE: string = (import.meta.env?.BASE_URL as string | undefined) ?? '/';

const asset = (p: string): string => `${BASE}${p.replace(/^\//, '')}`;

export const ASSETS = {
  images: {
    tiles: asset('assets/images/tiles.png'),
    actors: asset('assets/images/actors.png'),
    objects: asset('assets/images/objects.png'),
    doors: asset('assets/images/doors.png'),
  },
  audio: {
    bgm: asset('assets/audio/bgm.wav'),
    jump: asset('assets/audio/jump.wav'),
    gem: asset('assets/audio/gem.wav'),
    death: asset('assets/audio/death.wav'),
    lever: asset('assets/audio/lever.wav'),
    door: asset('assets/audio/door.wav'),
    push: asset('assets/audio/push.wav'),
    star: asset('assets/audio/star.wav'),
    win: asset('assets/audio/win.wav'),
    ui: asset('assets/audio/ui.wav'),
  },
} as const;

/* ----------------------------- 像素尺寸 ------------------------------- */

export const TILE_SIZE = 32; // 1 格子 = 32 px
export const VIEW_WIDTH = 960; // 逻辑画布尺寸（CSS 像素）
export const VIEW_HEIGHT = 540;

/* ----------------------------- 物理参数 ------------------------------- */

export const PHYSICS = {
  gravity: 1800, // px/s²
  maxFallSpeed: 900,
  /** 跳跃初始速度（向上为负）→ 跳跃高度约 113px（3.5 格） */
  jumpVelocity: -640,
  /** 站立/空中左右速度 → 滞空 0.71s，可跨约 4.8 格 */
  moveSpeed: 220,
  /** 飞行（减速） */
  airAccel: 2400,
  /** 松开跳跃时的额外向下加速度，让短跳更矮 */
  jumpCutGravity: 2800,
  coyoteTime: 0.1, // s
  jumpBufferTime: 0.12, // s
  /** 朝向相关：蹬墙跳不实现，但给一个摩擦 */
  groundFriction: 0.82,
  /** 碰撞解算时单帧最大子步位移，避免高速穿墙 */
  maxStepX: 8,
  maxStepY: 16,
  /** 角色宽高 */
  charW: 18,
  charH: 26,
  /** 推箱速度（比走路慢，箱子显得有重量） */
  pushSpeed: 120,
  /** 箱子宽高 */
  boxSize: 20,
  /** 门占位尺寸 */
  doorW: 32,
  doorH: 48,
} as const;

/* ----------------------------- 图块索引 ------------------------------- */
/* 与 scripts/gen-assets.mjs 中 TILE_KEYS 严格保持一致 */

export const TILES = {
  AIR: 0,
  STONE: 1,
  DIRT: 2,
  FIRE: 3,
  WATER: 4,
  ACID: 5,
  METAL: 6,
} as const;

/** 渲染图块集使用的索引（0-based sprite index on tiles.png） */
export const TILE_SPRITES = {
  [TILES.AIR]: -1,
  [TILES.STONE]: 0,
  [TILES.DIRT]: 1,
  [TILES.FIRE]: 2,
  [TILES.WATER]: 3,
  [TILES.ACID]: 4,
  [TILES.METAL]: 5,
} as const;

/* ----------------------------- 角色 ------------------------------- */

export const CHARACTER = {
  FIREBOY: 'fire' as const,
  WATERGIRL: 'water' as const,
} as const;

/* ----------------------------- 状态 / 事件 ------------------------------- */

export const GAME_EVENT = {
  GEM: 'gem',
  HAZARD: 'hazard',
  WIN: 'win',
  LEVER: 'lever',
  BUTTON: 'button',
  DOOR_OPEN: 'door_open',
  PLATFORM_TOGGLE: 'platform_toggle',
} as const;

/* ----------------------------- 持久化 ------------------------------- */

export const SAVE_KEY = 'bhy-lite-save-v1';
export const SETTINGS_KEY = 'bhy-lite-settings-v1';

/** 等级解锁判定：第 N 关解锁需 1..N-1 关至少 1 星 */
export const STAR_UNLOCK_RULE = (stars: number[]) => stars;

/* ----------------------------- 时间 ------------------------------- */

export const FIXED_DT = 1 / 120; // 物理固定步长
export const MAX_FRAME_DT = 1 / 30; // 防止长时 tab 切换造成大跳跃
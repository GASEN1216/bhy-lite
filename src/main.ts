/**
 * 入口文件 —— 串起所有子系统。
 *
 * 1) 启动时显示主菜单
 * 2) 进入关卡后启动固定步长游戏循环
 * 3) UI 通过 hooks 与游戏状态通信（暂停 / 重开 / 切关 / 调音量）
 */

import './styles.css';
import { FIXED_DT, MAX_FRAME_DT } from './core/constants';
import { Input } from './engine/input';
import { AssetLoader } from './engine/assets';
import { AudioManager } from './engine/audio';
import { stepWorld } from './game/world';
import { createGameState } from './game/level';
import { computeScore, snapshotRun } from './game/scoring';
import { findLevel, LEVELS } from './game/levels';
import { Renderer } from './game/render';
import { UI } from './ui/overlay';
import {
  applyResult,
  getProgress,
  loadSave,
  loadSettings,
  saveSettings,
} from './game/save';
import type { GameState } from './core/types';

async function bootstrap(): Promise<void> {
  const canvas = must(document.querySelector<HTMLCanvasElement>('#game-canvas'));
  const uiRoot = must(document.querySelector<HTMLElement>('#ui-root'));

  const settings = loadSettings();
  const assets = new AssetLoader();
  const audio = new AudioManager();
  audio.setVolumes(settings.master, settings.bgm, settings.sfx);

  const input = new Input();

  let renderer: Renderer | null = null;
  let game: GameState | null = null;
  let status: 'menu' | 'playing' | 'paused' | 'result' = 'menu';

  const ui = new UI(uiRoot, {
    onStart: () => startLevel(1),
    onSelectLevel: (id) => startLevel(id),
    onPause: () => {
      if (status !== 'playing' || !game) return;
      status = 'paused';
      game.status = 'paused';
      ui.showHud(false);
      ui.showPause();
      audio.stopBgm();
    },
    onResume: () => {
      if (status !== 'paused' || !game) return;
      status = 'playing';
      game.status = 'playing';
      ui.showPlaying();
      ui.showHud(true);
      audio.startBgm();
    },
    onRestart: () => {
      if (!game) return;
      const id = game.level.id;
      startLevel(id);
    },
    onMainMenu: () => {
      status = 'menu';
      ui.showHud(false);
      ui.showDeathOverlay(false);
      ui.showMenu();
      audio.stopBgm();
    },
    onVolumeChange: (m, b, s) => {
      audio.setVolumes(m, b, s);
      saveSettings({ version: 1, master: m, bgm: b, sfx: s });
    },
  }, settings);

  await assets.load();
  renderer = new Renderer({ canvas, assets });
  window.addEventListener('resize', () => renderer?.resize());

  // 主菜单背后放一张静止的第 1 关当背景（status='menu' 时不推进物理）
  game = createGameState(LEVELS[0]);

  function startLevel(id: number): void {
    const lv = findLevel(id);
    game = createGameState(lv);
    status = 'playing';
    ui.showHud(true);
    ui.showDeathOverlay(false);
    ui.showPlaying();
    audio.startBgm();
  }

  function finishRun(): void {
    if (!game) return;
    const run = snapshotRun(game);
    const score = computeScore(game.level, run);
    const prev = getProgress(loadSave(), game.level.id);
    const best = Number.isFinite(prev.bestTime) ? Math.min(prev.bestTime, run.elapsed) : run.elapsed;
    applyResult(loadSave(), game.level.id, {
      bestTime: best,
      stars: score.stars,
      gems: run.gemsCollected,
      completed: 1,
    });
    status = 'result';
    ui.showHud(false);
    ui.showResult({
      stars: score.stars,
      elapsed: run.elapsed,
      collected: run.gemsCollected,
      totalGems: run.totalGems,
      best,
      next: game.level.id + 1,
      hasNext: game.level.id < LEVELS.length,
      won: run.won,
    });
    audio.stopBgm();
  }

  function step(dt: number): void {
    if (!game) return;
    if (status === 'playing') {
      stepWorld(game, input, {
        playSfx: (name) => audio.play(name),
        onEvent: () => undefined,
      }, dt);
      input.endFrame();
      if (game.status === 'won') finishRun();
    }
  }

  function render(): void {
    if (!renderer || !game) return;
    renderer.draw(game, FIXED_DT);
    if (status === 'playing' || status === 'paused' || status === 'result') {
      const r = game.gems.filter((g) => g.collected && g.kind === 'fire').length;
      const b = game.gems.filter((g) => g.collected && g.kind === 'water').length;
      ui.updateHud(game.level.id, game.elapsed, r, b);
    }
    ui.showDeathOverlay(game.status === 'dead');
  }

  // 全局热键：暂停 / 重开 / 选中关卡（数字 1-5 快捷）
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape') {
      if (status === 'playing') {
        status = 'paused';
        if (game) game.status = 'paused';
        ui.showHud(false);
        ui.showPause();
        audio.stopBgm();
      } else if (status === 'paused' && game) {
        status = 'playing';
        game.status = 'playing';
        ui.showPlaying();
        ui.showHud(true);
        audio.startBgm();
      }
    }
    if (e.code === 'KeyR' && (status === 'playing' || status === 'paused') && game) {
      startLevel(game.level.id);
    }
    if (status === 'menu' || status === 'result') {
      const n = Number(e.key);
      if (n >= 1 && n <= LEVELS.length) startLevel(n);
    }
  });

  // 启动主循环
  let last = performance.now();
  let acc = 0;
  function tick(now: number): void {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME_DT) dt = MAX_FRAME_DT;
    acc += dt;
    let steps = 0;
    while (acc >= FIXED_DT && steps < 5) {
      step(FIXED_DT);
      acc -= FIXED_DT;
      steps++;
    }
    if (steps === 5) acc = 0;
    render();
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  ui.showLevels(LEVELS, loadSave().levels as Record<number, { unlocked: number; stars: number; bestTime: number; completed: number }>);
  ui.showMenu();

  // 暴露给 dev console
  (window as unknown as { __bhy__: unknown }).__bhy__ = { game: () => game, status: () => status, startLevel, save: loadSave() };
}

function must<T>(e: T | null): T {
  if (!e) throw new Error('element missing');
  return e;
}

bootstrap().catch((e) => {
  console.error('启动失败：', e);
  document.body.innerHTML = `<pre style="color:#fff;padding:20px">${String(e)}</pre>`;
});
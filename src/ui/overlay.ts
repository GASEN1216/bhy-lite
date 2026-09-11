/**
 * UI 浮层（HTML DOM）—— 菜单 / 关卡选择 / HUD / 暂停 / 设置 / 结算。
 *
 * 设计原则：游戏世界用 Canvas，UI 用 DOM。两层互不重叠，DOM 只画菜单。
 */

import type { LevelDef } from '../core/types';

export interface UIHooks {
  onStart: () => void;
  onSelectLevel: (id: number) => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onMainMenu: () => void;
  onVolumeChange: (m: number, bgm: number, sfx: number) => void;
}

export interface UISettings {
  master: number;
  bgm: number;
  sfx: number;
}

const CSS = `
:root {
  --bg: rgba(11, 16, 32, 0.86);
  --card: rgba(15, 23, 42, 0.94);
  --card-line: #475569;
  --text: #f8fafc;
  --text-dim: #cbd5e1;
  --accent: #fbbf24;
  --accent-2: #60a5fa;
  --danger: #ef4444;
  --success: #22c55e;
  --warn: #f97316;
}
#ui-root, #ui-root * {
  font-family: 'PingFang SC', 'Microsoft YaHei', system-ui, -apple-system, sans-serif;
  color: var(--text);
  box-sizing: border-box;
}
.overlay {
  position: absolute; inset: 0;
  display: none; align-items: center; justify-content: center;
  background: var(--bg);
  backdrop-filter: blur(6px);
  z-index: 10;
}
.overlay.show { display: flex; }
.card {
  background: var(--card);
  border: 1px solid var(--card-line);
  border-radius: 16px;
  padding: 28px 32px;
  min-width: 320px;
  max-width: 90vw;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
h1.title {
  margin: 0 0 4px 0;
  font-size: 28px;
  letter-spacing: 1px;
}
.subtitle {
  margin: 0 0 18px 0;
  color: var(--text-dim);
  font-size: 14px;
}
.menu-btn {
  display: block;
  width: 100%;
  padding: 12px 14px;
  margin: 8px 0;
  background: #1e293b;
  border: 1px solid var(--card-line);
  color: var(--text);
  border-radius: 10px;
  font-size: 16px;
  cursor: pointer;
  transition: background .12s, transform .08s;
}
.menu-btn:hover { background: #334155; }
.menu-btn:active { transform: translateY(1px); }
.menu-btn.primary { background: var(--accent); color: #1f2937; font-weight: 700; }
.menu-btn.primary:hover { background: #fcd34d; }
.menu-btn.danger { color: var(--danger); border-color: var(--danger); }
.menu-btn[disabled] { opacity: 0.4; cursor: not-allowed; }

.row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; margin: 8px 0;
}
.row label { font-size: 14px; color: var(--text-dim); }
.row input[type=range] {
  flex: 1;
  accent-color: var(--accent);
}
.row .val { width: 36px; text-align: right; color: var(--accent); font-variant-numeric: tabular-nums; }

.level-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  margin-top: 12px;
}
.lv-cell {
  position: relative;
  border: 1px solid var(--card-line);
  background: #1e293b;
  border-radius: 12px;
  padding: 16px 8px;
  cursor: pointer;
  font-size: 14px;
}
.lv-cell:hover { background: #334155; }
.lv-cell.locked { opacity: 0.4; cursor: not-allowed; }
.lv-cell .num { font-size: 24px; font-weight: 700; }
.lv-cell .name { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
.lv-cell .stars {
  margin-top: 8px;
  letter-spacing: 2px;
  color: #475569;
}
.lv-cell .stars .on { color: var(--accent); }
.lv-cell .best {
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.hud {
  position: absolute;
  top: 12px; left: 12px;
  display: none;
  align-items: center;
  gap: 16px;
  background: rgba(15, 23, 42, 0.72);
  padding: 8px 14px;
  border-radius: 12px;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
  z-index: 5;
}
.hud.show { display: flex; pointer-events: auto; }
.hud .lbl { color: var(--text-dim); margin-right: 4px; }
.hud .val { color: var(--accent); font-weight: 700; }
.hud .pause-btn {
  cursor: pointer; padding: 4px 10px; border-radius: 6px;
  background: #334155; border: 1px solid var(--card-line);
}
.hud .pause-btn:hover { background: #475569; }

.result .stars {
  font-size: 36px; letter-spacing: 6px; margin: 12px 0;
}
.result .stars .on { color: var(--accent); }
.result table {
  margin: 12px auto; border-collapse: collapse;
  font-size: 14px;
}
.result td {
  padding: 4px 12px;
  color: var(--text-dim);
}
.result td.v { color: var(--text); font-weight: 700; }

.hint {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 10px;
  line-height: 1.5;
}
.kbd {
  display: inline-block;
  background: #1e293b;
  border: 1px solid var(--card-line);
  border-radius: 6px;
  padding: 1px 6px;
  margin: 0 2px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  color: var(--text);
}
.death-overlay {
  position: absolute; inset: 0;
  background: rgba(239, 68, 68, 0.0);
  pointer-events: none;
  transition: background .15s;
  z-index: 6;
}
.death-overlay.show { background: rgba(239, 68, 68, 0.25); pointer-events: auto; cursor: not-allowed; }
`;

export class UI {
  private root: HTMLElement;
  private hooks: UIHooks;
  private settings: UISettings;
  private els: Record<string, HTMLElement> = {};
  private timers: Record<string, HTMLSpanElement> = {};

  constructor(root: HTMLElement, hooks: UIHooks, settings: UISettings) {
    this.root = root;
    this.hooks = hooks;
    this.settings = settings;
    injectCSS(CSS);
    this.build();
  }

  private build(): void {
    this.root.innerHTML = `
      <div class="overlay show" id="ui-menu">
        <div class="card">
          <h1 class="title">冰火双人行</h1>
          <p class="subtitle">Fireboy &amp; Watergirl · Lite</p>
          <button class="menu-btn primary" data-action="start">开始游戏</button>
          <button class="menu-btn" data-action="level-select">选关</button>
          <button class="menu-btn" data-action="settings-menu">设置</button>
          <p class="hint">
            <b>火男</b>　方向键 / Space<br>
            <b>水女</b>　W A S D<br>
            <b>暂停</b>　Esc · <b>重开</b>　R
          </p>
          <p class="hint">↑ 火怕水，水怕火，酸池两人都死。<br>同时到达终点门才能过关。</p>
        </div>
      </div>
      <div class="overlay" id="ui-levels">
        <div class="card" style="min-width:480px">
          <h1 class="title">选关</h1>
          <div class="level-grid" id="ui-levels-grid"></div>
          <button class="menu-btn" data-action="back-menu">返回</button>
        </div>
      </div>
      <div class="overlay" id="ui-settings">
        <div class="card">
          <h1 class="title">设置</h1>
          <div class="row">
            <label>主音量</label>
            <input type="range" id="ui-vol-master" min="0" max="100" />
            <span class="val" id="ui-vol-master-val">80</span>
          </div>
          <div class="row">
            <label>背景音乐</label>
            <input type="range" id="ui-vol-bgm" min="0" max="100" />
            <span class="val" id="ui-vol-bgm-val">60</span>
          </div>
          <div class="row">
            <label>音效</label>
            <input type="range" id="ui-vol-sfx" min="0" max="100" />
            <span class="val" id="ui-vol-sfx-val">90</span>
          </div>
          <button class="menu-btn primary" data-action="back-menu">返回</button>
        </div>
      </div>
      <div class="overlay" id="ui-pause">
        <div class="card">
          <h1 class="title">已暂停</h1>
          <button class="menu-btn primary" data-action="resume">继续</button>
          <button class="menu-btn" data-action="restart">重开本关</button>
          <button class="menu-btn" data-action="settings">设置</button>
          <button class="menu-btn" data-action="back-menu">主菜单</button>
        </div>
      </div>
      <div class="overlay result" id="ui-result">
        <div class="card">
          <h1 class="title" id="ui-result-title">过关！</h1>
          <div class="stars" id="ui-result-stars"></div>
          <table>
            <tr><td>用时</td><td class="v" id="ui-result-time">--</td></tr>
            <tr><td>收集宝石</td><td class="v" id="ui-result-gems">--</td></tr>
            <tr><td>最佳用时</td><td class="v" id="ui-result-best">--</td></tr>
          </table>
          <button class="menu-btn primary" data-action="next">下一关</button>
          <button class="menu-btn" data-action="restart">重玩</button>
          <button class="menu-btn" data-action="back-menu">主菜单</button>
        </div>
      </div>
      <div class="hud" id="ui-hud">
        <span><span class="lbl">关卡</span><span class="val" id="ui-hud-level">1</span></span>
        <span><span class="lbl">时间</span><span class="val" id="ui-hud-time">0.0</span></span>
        <span><span class="lbl">红宝石</span><span class="val" id="ui-hud-r">0</span></span>
        <span><span class="lbl">蓝宝石</span><span class="val" id="ui-hud-b">0</span></span>
        <span class="pause-btn" data-action="pause">⏸</span>
      </div>
      <div class="death-overlay" id="ui-death"></div>
    `;

    // 缓存
    for (const id of ['ui-menu', 'ui-levels', 'ui-settings', 'ui-pause', 'ui-result', 'ui-hud', 'ui-death']) {
      this.els[id] = must(this.root.querySelector('#' + id));
    }
    this.timers.time = must(this.root.querySelector('#ui-hud-time'));
    this.timers.r = must(this.root.querySelector('#ui-hud-r'));
    this.timers.b = must(this.root.querySelector('#ui-hud-b'));
    this.timers.level = must(this.root.querySelector('#ui-hud-level'));

    // 事件代理
    this.root.addEventListener('click', (e) => this.handleClick(e));
    const on = (id: string, fn: (v: number) => void) => {
      const el = must(this.root.querySelector(id)) as HTMLInputElement;
      el.addEventListener('input', () => fn(Number(el.value)));
    };
    on('#ui-vol-master', (v) => { this.settings.master = v / 100; this.updateVolumeLabels(); this.persist(); this.hooks.onVolumeChange(this.settings.master, this.settings.bgm, this.settings.sfx); });
    on('#ui-vol-bgm', (v) => { this.settings.bgm = v / 100; this.updateVolumeLabels(); this.persist(); this.hooks.onVolumeChange(this.settings.master, this.settings.bgm, this.settings.sfx); });
    on('#ui-vol-sfx', (v) => { this.settings.sfx = v / 100; this.updateVolumeLabels(); this.persist(); this.hooks.onVolumeChange(this.settings.master, this.settings.bgm, this.settings.sfx); });

    this.updateVolumeLabels();
  }

  private persist(): void {
    try { localStorage.setItem('bhy-lite-settings-v1', JSON.stringify({ version: 1, ...this.settings })); } catch { /* ignore */ }
  }

  private updateVolumeLabels(): void {
    const m = must(this.root.querySelector('#ui-vol-master')) as HTMLInputElement;
    const b = must(this.root.querySelector('#ui-vol-bgm')) as HTMLInputElement;
    const s = must(this.root.querySelector('#ui-vol-sfx')) as HTMLInputElement;
    m.value = String(Math.round(this.settings.master * 100));
    b.value = String(Math.round(this.settings.bgm * 100));
    s.value = String(Math.round(this.settings.sfx * 100));
    (must(this.root.querySelector('#ui-vol-master-val')) as HTMLElement).textContent = m.value;
    (must(this.root.querySelector('#ui-vol-bgm-val')) as HTMLElement).textContent = b.value;
    (must(this.root.querySelector('#ui-vol-sfx-val')) as HTMLElement).textContent = s.value;
  }

  private handleClick(e: Event): void {
    const t = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!t) return;
    const action = t.dataset.action!;
    switch (action) {
      case 'start':
        this.hooks.onStart();
        break;
      case 'level-select':
        this.showLevels();
        break;
      case 'settings-menu':
      case 'settings':
        this.showSettings();
        break;
      case 'back-menu':
        this.hooks.onMainMenu();
        break;
      case 'pause':
        this.hooks.onPause();
        break;
      case 'resume':
        this.hooks.onResume();
        break;
      case 'restart':
        this.hooks.onRestart();
        break;
      case 'next': {
        const next = Number(t.dataset.next ?? this.lastNext);
        this.hooks.onSelectLevel(next);
        break;
      }
    }
  }

  private lastNext = 2;
  private levelGrid(levels: readonly LevelDef[], progress: Record<number, { unlocked: number; stars: number; bestTime: number; completed: number }>): void {
    const grid = must(this.root.querySelector('#ui-levels-grid')) as HTMLElement;
    grid.innerHTML = '';
    levels.forEach((lv) => {
      const p = progress[lv.id] ?? { unlocked: 0, stars: 0, bestTime: NaN, completed: 0 };
      const locked = p.unlocked === 0;
      const cell = document.createElement('div');
      cell.className = 'lv-cell' + (locked ? ' locked' : '');
      cell.innerHTML = `
        <div class="num">${locked ? '🔒' : lv.id}</div>
        <div class="name">${lv.name}</div>
        <div class="stars">${[0, 1, 2].map((i) => `<span class="${i < p.stars ? 'on' : ''}">★</span>`).join('')}</div>
        <div class="best">${p.completed ? formatTime(p.bestTime) : '未通关'}</div>
      `;
      cell.addEventListener('click', () => {
        if (locked) return;
        this.hooks.onSelectLevel(lv.id);
      });
      grid.appendChild(cell);
    });
  }

  // ---------------------- 公开 API ----------------------

  showMenu(): void { this.showOnly('ui-menu'); }
  showPause(): void { this.showOnly('ui-pause'); }
  showSettings(): void { this.showOnly('ui-settings'); }
  showResult(opts: { stars: 0 | 1 | 2 | 3; elapsed: number; totalGems: number; collected: number; best: number; next: number; hasNext: boolean; won: boolean }): void {
    (must(this.root.querySelector('#ui-result-stars')) as HTMLElement).innerHTML = [0, 1, 2]
      .map((i) => `<span class="${i < opts.stars ? 'on' : ''}">★</span>`)
      .join('');
    (must(this.root.querySelector('#ui-result-time')) as HTMLElement).textContent = formatTime(opts.elapsed);
    (must(this.root.querySelector('#ui-result-gems')) as HTMLElement).textContent = `${opts.collected} / ${opts.totalGems}`;
    (must(this.root.querySelector('#ui-result-best')) as HTMLElement).textContent = Number.isFinite(opts.best) ? formatTime(opts.best) : '—';
    (must(this.root.querySelector('#ui-result-title')) as HTMLElement).textContent = opts.won ? '过关！' : '失败';
    const next = must(this.root.querySelector('[data-action=next]')) as HTMLButtonElement;
    next.disabled = !opts.hasNext;
    next.dataset.next = String(opts.next);
    this.lastNext = opts.next;
    this.showOnly('ui-result');
  }

  showLevels(levels?: readonly LevelDef[], progress?: Record<number, { unlocked: number; stars: number; bestTime: number; completed: number }>): void {
    if (levels && progress) this.levelGrid(levels, progress);
    this.showOnly('ui-levels');
  }

  showPlaying(): void {
    // 隐藏所有 .overlay 浮层；HUD 由 caller 单独控制
    for (const [k, el] of Object.entries(this.els)) {
      if (k === 'ui-hud' || k === 'ui-death') continue;
      el.classList.remove('show');
    }
  }

  showHud(show: boolean): void {
    this.els['ui-hud'].classList.toggle('show', show);
  }

  showDeathOverlay(show: boolean): void {
    this.els['ui-death'].classList.toggle('show', show);
  }

  updateHud(level: number, time: number, fireGems: number, waterGems: number): void {
    this.timers.level.textContent = String(level);
    this.timers.time.textContent = formatTime(time);
    this.timers.r.textContent = String(fireGems);
    this.timers.b.textContent = String(waterGems);
  }

  private showOnly(id: string): void {
    for (const [k, el] of Object.entries(this.els)) {
      if (k === 'ui-hud' || k === 'ui-death') continue;
      el.classList.toggle('show', k === id);
    }
  }
}

function injectCSS(css: string): void {
  const s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
}

function must<T>(e: T | null): T {
  if (!e) throw new Error('UI element missing');
  return e;
}

export function formatTime(s: number): string {
  if (!Number.isFinite(s)) return '--';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const tenth = Math.floor((s * 10) % 10);
  if (m > 0) return `${m}:${String(sec).padStart(2, '0')}`;
  return `${sec}.${tenth}`;
}
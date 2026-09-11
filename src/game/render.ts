/**
 * Canvas 2D 渲染 —— 纯绘制，无状态变更。
 *
 * 坐标系：世界像素 (x,y)。通过 ctx.setTransform(zoom,0,0,zoom,-cx*zoom, -cy*zoom)
 * 一次性套上相机，剩下所有绘制都用世界坐标。
 */

import {
  PHYSICS,
  TILE_SIZE,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from '../core/constants';
import type { GameState } from '../core/types';
import type { AssetLoader } from '../engine/assets';

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  assets: AssetLoader;
}

const TILE_SHEET_W = 16;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private assets: AssetLoader;
  private time = 0;
  private deathFlash = 0;

  constructor(opts: RendererOptions) {
    this.canvas = opts.canvas;
    this.assets = opts.assets;
    const ctx = opts.canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d unsupported');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const fit = Math.min(window.innerWidth / VIEW_WIDTH, window.innerHeight / VIEW_HEIGHT, 1);
    const cssW = Math.floor(VIEW_WIDTH * Math.max(0.6, Math.min(1, fit)));
    const cssH = Math.floor((VIEW_HEIGHT * cssW) / VIEW_WIDTH);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
  }

  draw(state: GameState, dt: number): void {
    this.time += dt;
    if (state.status === 'dead') this.deathFlash = Math.min(1, this.deathFlash + dt * 6);

    const ctx = this.ctx;
    const dpr = this.canvas.width / parseFloat(this.canvas.style.width || `${VIEW_WIDTH}`);
    const z = state.camera.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    // 套相机（CSS 坐标）
    ctx.save();
    ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    ctx.scale(z, z);
    ctx.translate(-state.camera.x, -state.camera.y);

    this.drawBackground(state);
    this.drawTiles(state);
    this.drawHazards(state);
    this.drawGates(state);
    this.drawPlatforms(state);
    this.drawGems(state);
    this.drawTriggers(state);
    this.drawDoors(state);
    this.drawBoxes(state);
    this.drawPlayer(state, state.players[0]);
    this.drawPlayer(state, state.players[1]);
    if (state.status === 'dead') this.drawDeathOverlay(state);
    ctx.restore();
  }

  private drawBackground(state: GameState): void {
    const ctx = this.ctx;
    const W = state.level.width * TILE_SIZE;
    const H = state.level.height * TILE_SIZE;
    // 渐变天空
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1e293b');
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 远景山影
    ctx.fillStyle = '#1f2937';
    for (let i = 0; i < 8; i++) {
      const baseX = (i * 180 + (i % 2) * 50);
      ctx.beginPath();
      ctx.moveTo(baseX, H);
      ctx.lineTo(baseX + 80, H - 80 - (i % 3) * 30);
      ctx.lineTo(baseX + 160, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawTiles(state: GameState): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.tiles;
    const drawTile = (x: number, y: number, idx: number) => {
      if (!sheet) {
        // fallback 颜色
        const colors = ['transparent', '#6b7280', '#7c5539', '#7c2d12', '#1e3a8a', '#3f6212', '#475569'];
        ctx.fillStyle = colors[idx] ?? '#000';
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        return;
      }
      ctx.drawImage(sheet, idx * TILE_SHEET_W, 0, TILE_SHEET_W, TILE_SHEET_W,
        x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    };
    for (const s of state.solids) {
      const idx = s.type === 1 ? 0 : s.type === 2 ? 1 : 5; // stone/dirt/metal
      drawTile(s.x / TILE_SIZE, s.y / TILE_SIZE, idx);
    }
  }

  private drawHazards(state: GameState): void {
    const ctx = this.ctx;
    for (const hz of state.hazards) {
      const baseColor = hz.type === 3 ? '#f97316' : hz.type === 4 ? '#3b82f6' : '#84cc16';
      const surface = hz.type === 3 ? '#fbbf24' : hz.type === 4 ? '#bfdbfe' : '#bef264';
      const y0 = hz.y;
      // 液面波动
      ctx.beginPath();
      ctx.moveTo(hz.x, y0 + TILE_SIZE);
      for (let dx = 0; dx <= TILE_SIZE; dx += 2) {
        const y = y0 + 4 + Math.sin((this.time * 2 + dx / 8 + hz.x / 16)) * 1.6;
        ctx.lineTo(hz.x + dx, y);
      }
      ctx.lineTo(hz.x + TILE_SIZE, y0 + TILE_SIZE);
      ctx.closePath();
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.fillStyle = surface;
      ctx.fillRect(hz.x, y0 + 8, TILE_SIZE, 3);
      // 气泡
      const phase = (this.time + hz.x * 0.1) % 1;
      ctx.fillStyle = surface;
      ctx.globalAlpha = 0.4 + phase * 0.3;
      ctx.beginPath();
      ctx.arc(hz.x + 4 + Math.sin(this.time) * 2, y0 + 14 - phase * 6, 1.5, 0, Math.PI * 2);
      ctx.arc(hz.x + 24 + Math.sin(this.time + 1) * 2, y0 + 22 - phase * 8, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawGates(state: GameState): void {
    const ctx = this.ctx;
    for (const g of state.gates) {
      // 金属 + 横条
      ctx.fillStyle = g.solid ? '#475569' : '#1f2937';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.fillStyle = g.solid ? '#fbbf24' : '#22c55e';
      ctx.fillRect(g.x, g.y + g.h / 2 - 4, g.w, 8);
      if (!g.solid) {
        // 通路：画箭头
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(g.x + g.w / 2, g.y + 8);
        ctx.lineTo(g.x + g.w / 2, g.y + g.h - 8);
        ctx.moveTo(g.x + g.w / 2 - 5, g.y + 12);
        ctx.lineTo(g.x + g.w / 2, g.y + 8);
        ctx.lineTo(g.x + g.w / 2 + 5, g.y + 12);
        ctx.stroke();
      }
    }
  }

  private drawPlatforms(state: GameState): void {
    const ctx = this.ctx;
    for (const p of state.platforms) {
      ctx.fillStyle = p.active ? '#94a3b8' : '#475569';
      ctx.fillRect(p.x, p.y, p.def.w * TILE_SIZE, p.def.h * TILE_SIZE);
      ctx.fillStyle = p.active ? '#cbd5e1' : '#64748b';
      ctx.fillRect(p.x, p.y, p.def.w * TILE_SIZE, 4);
      ctx.fillStyle = p.active ? '#64748b' : '#334155';
      ctx.fillRect(p.x, p.y + p.def.h * TILE_SIZE - 4, p.def.w * TILE_SIZE, 4);
      // 铆钉
      ctx.fillStyle = '#1f2937';
      const r = 2;
      ctx.beginPath(); ctx.arc(p.x + 4, p.y + p.def.h * TILE_SIZE / 2, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + p.def.w * TILE_SIZE - 4, p.y + p.def.h * TILE_SIZE / 2, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  private drawGems(state: GameState): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.objects;
    for (const g of state.gems) {
      if (g.collected) continue;
      if (sheet) {
        const idx = g.kind === 'fire' ? 0 : 1;
        const bob = Math.sin(this.time * 4 + g.x) * 1.5;
        ctx.globalAlpha = 1;
        ctx.drawImage(sheet, idx * TILE_SHEET_W, 0, TILE_SHEET_W, TILE_SHEET_W,
          g.x, g.y + bob, 16, 16);
      } else {
        ctx.fillStyle = g.kind === 'fire' ? '#ef4444' : '#3b82f6';
        ctx.fillRect(g.x, g.y, 16, 16);
      }
      // 光晕
      const grad = ctx.createRadialGradient(g.x + 8, g.y + 8, 0, g.x + 8, g.y + 8, 14);
      grad.addColorStop(0, g.kind === 'fire' ? 'rgba(251,191,36,0.4)' : 'rgba(147,197,253,0.4)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(g.x - 6, g.y - 6, 28, 28);
    }
    ctx.globalAlpha = 1;
  }

  private drawTriggers(state: GameState): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.objects;
    for (const t of state.triggers) {
      const x = t.def.col * TILE_SIZE;
      const y = t.def.row * TILE_SIZE;
      if (sheet) {
        let idx = t.def.kind === 'lever' ? (t.active ? 3 : 2) : t.active ? 5 : 4;
        ctx.drawImage(sheet, idx * TILE_SHEET_W, 0, TILE_SHEET_W, TILE_SHEET_W, x, y, 16, 16);
      } else {
        ctx.fillStyle = t.active ? '#22c55e' : '#94a3b8';
        ctx.fillRect(x + 4, y + 4, 8, 8);
      }
    }
  }

  private drawDoors(state: GameState): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.doors;
    for (const d of state.doors) {
      if (sheet) {
        const idx = d.kind === 'fire' ? (d.open ? 1 : 0) : d.open ? 3 : 2;
        ctx.drawImage(sheet, idx * 32, 0, 32, 48, d.x, d.y, 32, 48);
      } else {
        ctx.fillStyle = d.kind === 'fire' ? '#fb923c' : '#60a5fa';
        ctx.fillRect(d.x, d.y, d.w, d.h);
      }
      // 提示"两人到达时闪光"
      if (d.open) {
        ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(this.time * 5) * 0.15})`;
        ctx.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
      }
    }
  }

  private drawBoxes(state: GameState): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.objects;
    for (const b of state.boxes) {
      if (b.respawnIn > 0) {
        ctx.globalAlpha = Math.max(0, b.respawnIn / 1.4);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(b.x, b.y, 20, 20);
        ctx.globalAlpha = 1;
        continue;
      }
      if (sheet) {
        ctx.drawImage(sheet, 6 * TILE_SHEET_W, 0, TILE_SHEET_W, TILE_SHEET_W, b.x, b.y, 20, 20);
      } else {
        ctx.fillStyle = '#a16207';
        ctx.fillRect(b.x, b.y, 20, 20);
      }
    }
  }

  private drawPlayer(_state: GameState, p: GameState['players'][number]): void {
    const ctx = this.ctx;
    const sheet = this.assets.images.actors;
    const idx = p.kind === 'fire' ? 0 : 2;
    const walkFrame = Math.abs(p.vx) > 20 ? Math.floor(this.time * 8) % 2 : 0;
    if (p.dead) {
      ctx.globalAlpha = 0.4;
    }
    if (sheet) {
      const sx = (idx + walkFrame) * 16;
      const w = p.w;
      const h = p.h;
      ctx.save();
      ctx.translate(p.x + w / 2, p.y + h);
      if (p.facing < 0) ctx.scale(-1, 1);
      ctx.drawImage(sheet, sx, 0, 16, 24, -w / 2, -h, w, h);
      ctx.restore();
    } else {
      ctx.fillStyle = p.kind === 'fire' ? '#ef4444' : '#3b82f6';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    ctx.globalAlpha = 1;

    // 跳起脚印光圈
    if (!p.onGround && !p.dead) {
      ctx.fillStyle = p.kind === 'fire' ? 'rgba(251,191,36,0.4)' : 'rgba(147,197,253,0.4)';
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y + p.h + 2, 4 + Math.sin(this.time * 6) * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    void PHYSICS;
  }

  private drawDeathOverlay(_state: GameState): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(239,68,68,${0.2 + this.deathFlash * 0.15})`;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }
}
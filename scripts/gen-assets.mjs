#!/usr/bin/env node
/**
 * 生成全部游戏素材到 public/assets/。
 *
 * 所有美术（像素图）与音频（8-bit 音效 / BGM）都由本脚本用代码程序化生成，
 * 不下载任何第三方文件 —— 因此全部为原创内容，按 CC0 1.0 释出（见 ASSET_LICENSES.md）。
 *
 * 用法：pnpm gen:assets
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Raster, mix, speckle } from './lib/pixel.mjs';
import { createTrack, note, trackToWav, hz, st } from './lib/audio.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMG = join(ROOT, 'public', 'assets', 'images');
const AUD = join(ROOT, 'public', 'assets', 'audio');

mkdirSync(IMG, { recursive: true });
mkdirSync(AUD, { recursive: true });

const written = [];
function save(relPath, buffer) {
  const p = join(ROOT, 'public', 'assets', relPath);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buffer);
  written.push([relPath, buffer.length]);
}

/* ================================ 地形图块 ================================ */
/* 顺序必须与 src/core/constants.ts 中 TILE_SPRITES 一致 */
const TILE_SIZE = 16;
const TILE_KEYS = ['stone', 'dirt', 'fire', 'water', 'acid', 'metal'];

function drawPoolTile(r, ox, top, mid, deep, foam, seed) {
  // 上方 4px 留空（液面会波动，由渲染层做动画）
  r.shade((x, y) => null);
  for (let y = 4; y < 16; y++) {
    const t = (y - 4) / 11;
    const c = mix(mix(top, mid, Math.min(1, t * 2)), deep, Math.max(0, t * 1.2 - 0.2));
    for (let x = 0; x < 16; x++) r.set(ox + x, y, c);
  }
  // 液面泡沫
  for (let x = 0; x < 16; x++) {
    const wave = Math.round(Math.sin((x / 16) * Math.PI * 2) * 1.2);
    r.rect(ox + x, 3 + wave, 1, 2, foam);
  }
  // 高光斑点
  speckle(r, ox, 8, 16, 8, [foam], seed, 0.06);
  r.rect(ox, 15, 16, 1, deep);
}

function buildTiles() {
  const r = new Raster(TILE_SIZE * TILE_KEYS.length, TILE_SIZE);
  // 0 stone：地表砖
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const t = y / 15;
      r.set(x, y, mix('#9ca3af', '#4b5563', t));
    }
  }
  r.rect(0, 0, 16, 2, '#c3cad4');
  r.rect(0, 15, 16, 1, '#374151');
  r.rect(0, 0, 1, 16, '#7c8794');
  r.rect(15, 0, 1, 16, '#3f4854');
  r.rect(0, 8, 16, 1, '#5b6675'); // 砖缝
  r.rect(8, 0, 1, 8, '#5b6675');
  r.rect(4, 9, 1, 7, '#5b6675');
  r.rect(12, 9, 1, 7, '#5b6675');
  speckle(r, 0, 0, 16, 16, ['#8b95a3', '#5c6673'], 11, 0.07);

  // 1 dirt：地底
  r.rect(16, 0, 16, 16, '#7c5539');
  speckle(r, 16, 0, 16, 16, ['#5f3f28', '#96693f', '#6b4529'], 23, 0.16);
  r.rect(16, 0, 16, 1, '#8a6242');

  // 2 fire / 3 water / 4 acid
  drawPoolTile(r, 32, '#fde68a', '#f97316', '#b91c1c', '#fff7c2', 7);
  drawPoolTile(r, 48, '#bfdbfe', '#3b82f6', '#1e3a8a', '#e0f2fe', 13);
  drawPoolTile(r, 64, '#d9f99d', '#65a30d', '#365314', '#ecfccb', 29);

  // 5 metal：机关平台/闸门
  r.rect(80, 0, 16, 16, '#8a97a8');
  r.rect(80, 0, 16, 2, '#d3dce8');
  r.rect(80, 14, 16, 2, '#59647a');
  for (let i = -16; i < 16; i += 4) {
    for (let y = 0; y < 16; y++) {
      const x = i + y;
      if (x >= 0 && x < 16) r.blend(80 + x, y, '#ffffff', 0.06);
    }
  }
  for (const [rx, ry] of [[3, 3], [12, 3], [3, 12], [12, 12]]) r.circle(80 + rx, ry, 1.2, '#3f4a5c');
  r.rect(80, 0, 1, 16, '#5c6675');
  r.rect(95, 0, 1, 16, '#5c6675');

  save('images/tiles.png', r.toPNG());
}

/* ================================= 角色 ================================= */
/* 顺序：fireboy-idle, fireboy-walk, watergirl-idle, watergirl-walk */
const ACTOR_W = 16;
const ACTOR_H = 24;

function drawActor(r, ox, p, frame) {
  const { hair, hairLit, skin, body, bodyDark, limb, eye } = p;
  // 影子
  r.rect(ox + 4, 22, 8, 2, '#00000033');
  // 腿
  if (frame === 0) {
    r.rect(ox + 5, 17, 2, 5, limb);
    r.rect(ox + 9, 17, 2, 5, limb);
    r.rect(ox + 4, 22, 4, 2, bodyDark);
    r.rect(ox + 8, 22, 4, 2, bodyDark);
  } else {
    r.rect(ox + 3, 17, 2, 5, limb);
    r.rect(ox + 11, 17, 2, 5, limb);
    r.rect(ox + 2, 22, 4, 2, bodyDark);
    r.rect(ox + 10, 22, 4, 2, bodyDark);
  }
  // 躯干
  r.rect(ox + 4, 9, 8, 9, body);
  r.rect(ox + 4, 9, 8, 2, bodyDark);
  r.rect(ox + 4, 16, 8, 2, bodyDark);
  r.circle(ox + 8, 13.5, 1.6, p.emblem);
  // 手臂
  if (frame === 0) {
    r.rect(ox + 2, 10, 2, 6, limb);
    r.rect(ox + 12, 10, 2, 6, limb);
  } else {
    r.rect(ox + 1, 11, 2, 5, limb);
    r.rect(ox + 13, 9, 2, 5, limb);
  }
  // 头
  r.circle(ox + 8, 7, 4.4, skin);
  r.rect(ox + 4, 2, 8, 4, hair);
  r.rect(ox + 4, 2, 8, 1, hairLit);
  r.circle(ox + 8, 3.2, 4.1, hair);
  r.rect(ox + 4, 2, 8, 1, hairLit);
  // 眼睛 + 嘴
  r.rect(ox + 6, 7, 1, 2, eye);
  r.rect(ox + 9, 7, 1, 2, eye);
  r.rect(ox + 7, 10, 2, 1, '#00000055');
}

function buildActors() {
  const r = new Raster(ACTOR_W * 4, ACTOR_H);
  const fire = {
    hair: '#ea580c', hairLit: '#fbbf24', skin: '#fee2d5',
    body: '#ef4444', bodyDark: '#991b1b', limb: '#b91c1c',
    emblem: '#fbbf24', eye: '#1f2937',
  };
  const water = {
    hair: '#2563eb', hairLit: '#93c5fd', skin: '#fde8d7',
    body: '#3b82f6', bodyDark: '#1d4ed8', limb: '#1e3a8a',
    emblem: '#bfdbfe', eye: '#0f172a',
  };
  drawActor(r, 0, fire, 0);
  drawActor(r, ACTOR_W, fire, 1);
  drawActor(r, ACTOR_W * 2, water, 0);
  drawActor(r, ACTOR_W * 3, water, 1);
  save('images/actors.png', r.toPNG());
}

/* ================================= 物件 ================================= */
/* 顺序：gem-red, gem-blue, lever-off, lever-on, button-off, button-on, box, gate */
function drawGem(r, ox, main, light, dark) {
  for (let y = 1; y < 15; y++) {
    for (let x = 2; x < 14; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5) * 0.85;
      if (d > 6.2) continue;
      const t = (y - 1) / 13;
      const c = d < 2 ? light : mix(light, main, Math.min(1, t * 1.6));
      r.set(ox + x, y, d > 5.2 ? dark : c);
    }
  }
  r.rect(ox + 5, 3, 2, 4, '#ffffffcc');
  r.set(ox + 4, 4, '#ffffff88');
  r.set(ox + 7, 14, dark);
}

function drawLever(r, ox, on) {
  r.rect(ox + 2, 11, 12, 4, '#4b5563');
  r.rect(ox + 2, 11, 12, 1, '#94a3b8');
  r.rect(ox + 7, 5, 2, 7, '#64748b');
  r.circle(ox + 8, 12, 2, on ? '#22c55e' : '#94a3b8');
  if (on) {
    r.rect(ox + 8, 4, 6, 2, '#f59e0b');
    r.circle(ox + 14, 5, 2, '#fbbf24');
  } else {
    r.rect(ox + 2, 4, 6, 2, '#f59e0b');
    r.circle(ox + 2, 5, 2, '#fbbf24');
  }
}

function drawButton(r, ox, on) {
  const y = on ? 11 : 8;
  r.rect(ox + 1, 13, 14, 3, '#475569');
  r.rect(ox + 2, y, 12, 13 - y, on ? '#64748b' : '#94a3b8');
  r.rect(ox + 3, y, 10, 2, on ? '#22c55e' : '#cbd5e1');
  if (on) r.rect(ox + 1, 9, 14, 4, '#22c55e55');
}

function drawBox(r, ox) {
  r.rect(ox + 1, 1, 14, 14, '#c08433');
  r.rect(ox + 1, 1, 14, 2, '#e0a955');
  r.rect(ox + 1, 13, 14, 2, '#8a5a22');
  // 边框
  r.rect(ox + 1, 1, 14, 1, '#6b3f14');
  r.rect(ox + 1, 14, 14, 1, '#6b3f14');
  r.rect(ox + 1, 1, 1, 14, '#6b3f14');
  r.rect(ox + 14, 1, 1, 14, '#6b3f14');
  // 交叉加固条
  for (let i = 0; i < 12; i++) {
    r.set(ox + 2 + i, 2 + i, '#8a5a22');
    r.set(ox + 3 + i, 2 + i, '#a8702c');
    r.set(ox + 13 - i, 2 + i, '#8a5a22');
    r.set(ox + 12 - i, 2 + i, '#a8702c');
  }
  speckle(r, ox + 2, 2, 12, 12, ['#b3762c', '#d0a05a'], 41, 0.06);
}

function drawGateBlock(r, ox) {
  r.rect(ox, 0, 16, 16, '#5b6675');
  r.rect(ox, 0, 16, 1, '#94a3b8');
  r.rect(ox, 15, 16, 1, '#3f4a5c');
  for (let x = 1; x < 16; x += 4) r.rect(ox + x, 1, 2, 14, '#8a97a8');
  r.rect(ox, 6, 16, 3, '#fbbf24');
  r.rect(ox, 6, 16, 1, '#fde68a');
  r.rect(ox, 8, 16, 1, '#b45309');
}

function buildObjects() {
  const r = new Raster(16 * 8, 16);
  drawGem(r, 0, '#ef4444', '#fca5a5', '#7f1d1d');
  drawGem(r, 16, '#3b82f6', '#93c5fd', '#1e3a8a');
  drawLever(r, 32, false);
  drawLever(r, 48, true);
  drawButton(r, 64, false);
  drawButton(r, 80, true);
  drawBox(r, 96);
  drawGateBlock(r, 112);
  save('images/objects.png', r.toPNG());
}

/* ================================= 终点门 ================================= */
/* 顺序：fire-closed, fire-open, water-closed, water-open （32x48） */
function drawDoor(r, ox, tint, glow, open) {
  // 门框
  r.rect(ox + 1, 8, 30, 40, '#4b5563');
  r.circle(ox + 16, 10, 14, '#4b5563');
  r.rect(ox + 3, 10, 26, 38, '#1f2937');
  r.circle(ox + 16, 11, 11.5, '#1f2937');
  // 门芯
  const inner = (fn) => {
    for (let y = 10; y < 48; y++) {
      for (let x = 4; x < 28; x++) {
        const dx = (x - 16) / 11.5;
        const dy = (y - 11) / 11.5;
        if (y < 12 && dx * dx + dy * dy > 1) continue;
        fn(x, y);
      }
    }
  };
  if (open) {
    inner((x, y) => r.set(ox + x, y, '#0b1220'));
    inner((x, y) => {
      const edge = Math.min(x - 4, 27 - x, y - 10);
      if (edge < 4) r.blend(ox + x, y, glow, 0.55 - edge * 0.1);
    });
  } else {
    inner((x, y) => {
      const t = (y - 10) / 38;
      r.set(ox + x, y, mix(glow, tint, t));
    });
    inner((x, y) => {
      if ((x + y) % 6 === 0) r.blend(ox + x, y, '#ffffff', 0.12);
    });
    // 元素符号
    if (tint === '#b91c1c') {
      for (let i = 0; i < 7; i++) r.rect(ox + 16 - (7 - i) / 2, 22 + i, 7 - i, 1, '#fff7ed');
    } else {
      for (let i = 0; i < 7; i++) r.rect(ox + 16 - (7 - i) / 2, 22 + i, 7 - i, 1, '#eff6ff');
      r.circle(ox + 16, 32, 2, '#eff6ff');
    }
  }
}

function buildDoors() {
  const r = new Raster(32 * 4, 48);
  drawDoor(r, 0, '#b91c1c', '#fb923c', false);
  drawDoor(r, 32, '#b91c1c', '#fb923c', true);
  drawDoor(r, 64, '#1e3a8a', '#60a5fa', false);
  drawDoor(r, 96, '#1e3a8a', '#60a5fa', true);
  save('images/doors.png', r.toPNG());
}

/* ================================= 音频 ================================= */
const SFX = {
  'jump.wav': (t) => note(t, { freq: 420, glideTo: 880, dur: 0.12, wave: 'square', gain: 0.22, decay: 0.09 }),
  'gem.wav': (t) => {
    note(t, { freq: hz(st('E6')), start: 0, dur: 0.07, wave: 'triangle', gain: 0.3, decay: 0.05 });
    note(t, { freq: hz(st('B6')), start: 0.06, dur: 0.11, wave: 'triangle', gain: 0.26, decay: 0.07 });
  },
  'death.wav': (t) => {
    note(t, { freq: 320, glideTo: 70, dur: 0.5, wave: 'saw', gain: 0.26, decay: 0.25 });
    note(t, { freq: 160, glideTo: 40, dur: 0.5, wave: 'square', gain: 0.12, decay: 0.3 });
  },
  'lever.wav': (t) => {
    note(t, { freq: 880, dur: 0.04, wave: 'square', gain: 0.22 });
    note(t, { freq: 1320, start: 0.04, dur: 0.06, wave: 'square', gain: 0.16 });
  },
  'door.wav': (t) => {
    note(t, { freq: hz(st('C5')), dur: 0.18, wave: 'triangle', gain: 0.24, decay: 0.12 });
    note(t, { freq: hz(st('G5')), start: 0.1, dur: 0.22, wave: 'triangle', gain: 0.2, decay: 0.14 });
  },
  'push.wav': (t) => note(t, { freq: 130, glideTo: 90, dur: 0.09, wave: 'square', gain: 0.16, decay: 0.06 }),
  'star.wav': (t) => {
    ['C5', 'E5', 'G5'].forEach((n, i) =>
      note(t, { freq: hz(st(n)), start: i * 0.09, dur: 0.16, wave: 'triangle', gain: 0.24, decay: 0.1 })
    );
  },
  'win.wav': (t) => {
    ['C5', 'E5', 'G5', 'C6', 'E6'].forEach((n, i) =>
      note(t, { freq: hz(st(n)), start: i * 0.11, dur: 0.3, wave: 'triangle', gain: 0.26, decay: 0.18 })
    );
    note(t, { freq: hz(st('C4')), start: 0, dur: 0.7, wave: 'triangle', gain: 0.16, decay: 0.4 });
  },
  'ui.wav': (t) => note(t, { freq: 660, dur: 0.05, wave: 'square', gain: 0.16 }),
};

function buildAudio() {
  for (const [name, fill] of Object.entries(SFX)) {
    const t = createTrack(0.8);
    fill(t);
    save(`audio/${name}`, trackToWav(t, 0.7));
  }

  // BGM：Am - F - C - G，8 秒循环
  const bgm = createTrack(8);
  const chords = [
    { bass: 'A2', tones: ['A4', 'C5', 'E5'] },
    { bass: 'F2', tones: ['F4', 'A4', 'C5'] },
    { bass: 'C3', tones: ['C5', 'E5', 'G5'] },
    { bass: 'G2', tones: ['G4', 'B4', 'D5'] },
  ];
  chords.forEach((chord, ci) => {
    const t0 = ci * 2;
    note(bgm, { freq: hz(st(chord.bass)), start: t0, dur: 1.9, wave: 'triangle', gain: 0.2, decay: 0.9 });
    for (let i = 0; i < 8; i++) {
      const n = chord.tones[[0, 1, 2, 1][i % 4]];
      note(bgm, { freq: hz(st(n)), start: t0 + i * 0.25, dur: 0.22, wave: 'square', gain: 0.075, decay: 0.09 });
    }
  });
  for (let i = 0; i < 32; i++) {
    note(bgm, { freq: 6000, start: i * 0.25, dur: 0.03, wave: 'noise', gain: 0.03, decay: 0.02 });
  }
  save('audio/bgm.wav', trackToWav(bgm, 0.55));
}

/* ================================= 入口 ================================= */
buildTiles();
buildActors();
buildObjects();
buildDoors();
buildAudio();

const total = written.reduce((s, [, n]) => s + n, 0);
console.log('素材生成完成：');
for (const [p, n] of written) console.log(`  public/assets/${p.padEnd(28)} ${(n / 1024).toFixed(1)} KB`);
console.log(`  合计 ${written.length} 个文件，${(total / 1024).toFixed(1)} KB`);

/**
 * 摄像机：跟随两个角色，自动缩小以使双方同框。
 * 输出 (cx, cy, zoom)。zoom=1 表示 1 世界像素 = 1 屏幕像素。
 */

import { VIEW_HEIGHT, VIEW_WIDTH } from '../core/constants';
import { clamp, lerp } from '../core/math';
import type { PlayerState } from '../core/types';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export function updateCamera(
  cam: CameraState,
  players: readonly PlayerState[],
  levelWidthPx: number,
  levelHeightPx: number,
  dt: number
): void {
  if (players.length === 0) return;
  const a = players[0];
  const b = players[1] ?? players[0];
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const mx = (ac.x + bc.x) / 2;
  const my = (ac.y + bc.y) / 2;

  // 计算需求框：覆盖两个角色 + margin，以及水平方向额外 padding
  const dx = Math.abs(ac.x - bc.x);
  const dy = Math.abs(ac.y - bc.y);
  const padding = 48;
  const needW = Math.max(VIEW_WIDTH, dx + VIEW_WIDTH * 0.4) + padding * 2;
  const needH = Math.max(VIEW_HEIGHT, dy + VIEW_HEIGHT * 0.4) + padding * 2;

  // 关键区别：水平方向用 fit-to-width（让整个关卡可见），垂直方向允许稍微跟随
  // 这样小关卡全程可见，大关卡平移/拉远
  const fitZoom = Math.min(
    VIEW_WIDTH / needW,
    VIEW_HEIGHT / needH,
    1.0 // 不要放大
  );

  const targetZoom = clamp(fitZoom, 0.55, 1.0);

  // 摄像机中心：水平方向跟随 mid，但夹在关卡中心；垂直方向跟随 mid。
  // 如果关卡水平比视口还小，cx 永远等于关卡中点。
  const worldViewW = VIEW_WIDTH / targetZoom;
  const worldViewH = VIEW_HEIGHT / targetZoom;
  // 关卡比视口还小时（小关卡 / 拉得很远），直接居中，避免 min > max 导致 clamp 抖动
  const tcx =
    worldViewW >= levelWidthPx
      ? levelWidthPx / 2
      : clamp(mx, worldViewW / 2, levelWidthPx - worldViewW / 2);
  const tcy =
    worldViewH >= levelHeightPx
      ? levelHeightPx / 2
      : clamp(my, worldViewH / 2, levelHeightPx - worldViewH / 2);

  // 平滑
  const smoothT = clamp(dt * 8, 0, 1);
  cam.x = lerp(cam.x, tcx, smoothT);
  cam.y = lerp(cam.y, tcy, smoothT);
  cam.zoom = lerp(cam.zoom, targetZoom, smoothT);
}
/**
 * 固定步长的游戏循环 —— 把变长帧时间按固定 dt 切片交给 update()。
 * 同时调用 render() 一次（每真实帧一次）。
 *
 * 使用方法：
 *   const loop = new GameLoop({fixedDt, maxFrameDt, update, render});
 *   loop.start();
 *   loop.stop();
 *
 * update(dt) 中的逻辑应当确定性：同一 dt + 同一输入，永远产生同样的状态。
 */

import { FIXED_DT, MAX_FRAME_DT } from '../core/constants';

export interface LoopOptions {
  fixedDt?: number;
  maxFrameDt?: number;
  /** 物理步进 —— 必为确定性 */
  update: (dt: number) => void;
  /** 渲染（每真实帧 1 次） */
  render: (alpha: number) => void;
}

export class GameLoop {
  private acc = 0;
  private last = 0;
  private rafId: number | null = null;
  private running = false;
  private fixedDt: number;
  private maxFrameDt: number;
  private update: (dt: number) => void;
  private render: (alpha: number) => void;

  constructor(opts: LoopOptions) {
    this.fixedDt = opts.fixedDt ?? FIXED_DT;
    this.maxFrameDt = opts.maxFrameDt ?? MAX_FRAME_DT;
    this.update = opts.update;
    this.render = opts.render;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const tick = (now: number) => {
      if (!this.running) return;
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > this.maxFrameDt) dt = this.maxFrameDt;
      this.acc += dt;
      let steps = 0;
      while (this.acc >= this.fixedDt && steps < 5) {
        this.update(this.fixedDt);
        this.acc -= this.fixedDt;
        steps++;
      }
      if (steps === 5) this.acc = 0; // 防止掉帧积累导致无限追赶
      this.render(this.acc / this.fixedDt);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** 在 setup 阶段可手动跑一帧 update */
  stepOnce(dt: number): void {
    this.update(dt);
  }
}
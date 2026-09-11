#!/usr/bin/env tsx
/**
 * 关卡体检脚本：pnpm verify:levels
 *
 * 输出每张关卡的 ASCII 预览 + 一系列结构性 / 可玩性断言：
 *   1. 尺寸、图例字符合法性
 *   2. 出生点脚下必须有固体（否则一出生就掉出世界）
 *   3. 门必须站在固体上
 *   4. 触发器 / 闸门的 target 互相引用必须存在
 *   5. 危险池下方必须有地基（不能掉出世界）
 *   6. 用真实物理模拟"从出生点自由落体"，检查是否稳定停在地面
 */

import { LEVELS } from '../src/game/levels';
import { createGameState } from '../src/game/level';
import { Input } from '../src/engine/input';
import { stepWorld } from '../src/game/world';
import { PHYSICS, TILE_SIZE } from '../src/core/constants';

let failures = 0;
function check(ok: boolean, msg: string): void {
  if (!ok) {
    failures++;
    console.log(`   ✗ ${msg}`);
  }
}

for (const lv of LEVELS) {
  console.log(`\n=== 关卡 ${lv.id}  ${lv.name}  (${lv.width}x${lv.height}) ===`);
  console.log(`    ${lv.hint}`);

  // ---- ASCII 预览（带列标尺） ----
  const tens = Array.from({ length: Math.ceil(lv.width / 10) }, (_, i) => String(i * 10).padEnd(10)).join('');
  const ones = Array.from({ length: lv.width }, (_, i) => String(i % 10)).join('');
  console.log(`      ${tens}`);
  console.log(`      ${ones}`);
  lv.map.forEach((row, i) => {
    console.log(`${String(i).padStart(3)} | ${row}`);
  });

  // ---- 实体摘要 ----
  console.log(
    `    出生 F=(${lv.spawns.fire.x},${lv.spawns.fire.y})  W=(${lv.spawns.water.x},${lv.spawns.water.y})` +
    `  门 D=(${lv.doors.fire.col},${lv.doors.fire.row}) d=(${lv.doors.water.col},${lv.doors.water.row})`
  );
  console.log(
    `    宝石 ${lv.gems.length}（红 ${lv.gems.filter((g) => g.kind === 'fire').length} / 蓝 ${lv.gems.filter((g) => g.kind === 'water').length}）` +
    `  箱子 ${lv.boxes.length}  拉杆/按钮 ${lv.triggers.length}  平台 ${lv.movingPlatforms.length}  闸门 ${lv.gates.length}`
  );

  // ---- 1. 尺寸 ----
  check(lv.width === 40 && lv.height === 20, `尺寸应为 40x20，实际 ${lv.width}x${lv.height}`);
  for (const [i, row] of lv.map.entries()) {
    check(row.length === lv.width, `第 ${i} 行长度 ${row.length} != ${lv.width}`);
    for (const ch of row) {
      check('#,Mfwa.'.includes(ch), `第 ${i} 行含非法字符 '${ch}'`);
    }
  }

  const at = (c: number, r: number): string => (lv.map[r] && lv.map[r][c]) || '.';

  // ---- 2. 出生点脚下有固体 ----
  for (const [name, sp] of [['火男', lv.spawns.fire], ['水女', lv.spawns.water]] as const) {
    check(
      at(sp.x, sp.y + 1) === '#' || at(sp.x, sp.y + 1) === ',' || at(sp.x, sp.y + 1) === 'M',
      `${name} 出生点 (${sp.x},${sp.y}) 下方不是固体（'${at(sp.x, sp.y + 1)}'）`
    );
  }

  // ---- 3. 门脚下有固体 ----
  for (const [name, d] of [['火门', lv.doors.fire], ['水门', lv.doors.water]] as const) {
    check(
      ['#', ',', 'M'].includes(at(d.col, d.row + 1)),
      `${name} (${d.col},${d.row}) 下方不是固体（'${at(d.col, d.row + 1)}'）`
    );
  }

  // ---- 4. target 引用完整 ----
  const triggerIds = new Set(lv.triggers.map((t) => t.id));
  const platformIds = new Set(lv.movingPlatforms.map((p) => p.id));
  const gateIds = new Set(lv.gates.map((g) => g.id));
  for (const t of lv.triggers) {
    for (const target of t.targets) {
      check(
        platformIds.has(target) || gateIds.has(target),
        `触发器 ${t.id} 的 target '${target}' 不存在`
      );
    }
  }
  for (const p of lv.movingPlatforms) {
    if (p.mode !== 'trigger') continue;
    check(p.targets.length > 0, `平台 ${p.id} 是 trigger 模式但没有 targets`);
    for (const target of p.targets) {
      check(triggerIds.has(target), `平台 ${p.id} 的 target '${target}' 不是已定义的触发器`);
    }
  }
  for (const g of lv.gates) {
    for (const target of g.targets) {
      check(triggerIds.has(target), `闸门 ${g.id} 的 target '${target}' 不是已定义的触发器`);
    }
  }

  // ---- 4b. 移动平台行程合法性 ----
  for (const p of lv.movingPlatforms) {
    const x0 = p.col * TILE_SIZE;
    const y0 = p.row * TILE_SIZE;
    const off = p.distance * TILE_SIZE;
    const x1 = p.axis === 'x' ? x0 + off : x0;
    const y1 = p.axis === 'y' ? y0 + off : y0;
    const w = p.w * TILE_SIZE;
    const h = p.h * TILE_SIZE;
    check(x0 >= 0 && x0 + w <= lv.width * TILE_SIZE, `平台 ${p.id} 起点越界`);
    check(x1 >= 0 && x1 + w <= lv.width * TILE_SIZE, `平台 ${p.id} 终点越界 (x=${x1})`);
    check(y0 >= 0 && y0 + h <= lv.height * TILE_SIZE, `平台 ${p.id} 起点 Y 越界`);
    check(y1 >= 0 && y1 + h <= lv.height * TILE_SIZE, `平台 ${p.id} 终点 Y 越界 (y=${y1})`);

    // 升降台（axis=y）的整条竖直通道必须是空气，否则会卡在地形里
    if (p.axis === 'y') {
      const top = Math.min(p.row, p.row + p.distance);
      const bottom = Math.max(p.row, p.row + p.distance);
      for (let r = top; r <= bottom; r++) {
        for (let c = p.col; c < p.col + p.w; c++) {
          const ch = at(c, r);
          check(ch === '.' || 'fwa'.includes(ch), `升降台 ${p.id} 通道 (${c},${r}) 被 '${ch}' 挡住`);
        }
      }
      // 到达端旁边必须有同高度的高台可以踏上（左邻或右邻那一行是固体）
      const topRow = p.row + p.distance;
      const hasLedge =
        ['#', ',', 'M'].includes(at(p.col - 1, topRow)) ||
        ['#', ',', 'M'].includes(at(p.col + p.w, topRow));
      check(hasLedge, `升降台 ${p.id} 顶端 (col ${p.col}, row ${topRow}) 旁边没有可站立的高台`);
    }
    if (p.axis === 'x') {
      // 横向桥的两端都应该挨着可站立地面
      const rightEnd = p.col + p.w + p.distance;
      check(
        ['#', ',', 'M'].includes(at(p.col - 1, p.row + p.h)) ||
        ['#', ',', 'M'].includes(at(p.col - 1, p.row)),
        `横向平台 ${p.id} 左端 (col ${p.col - 1}) 没有可站立的岸`
      );
      check(
        ['#', ',', 'M'].includes(at(rightEnd, p.row + p.h)) ||
        ['#', ',', 'M'].includes(at(rightEnd, p.row)),
        `横向平台 ${p.id} 右端 (col ${rightEnd}) 没有可站立的岸`
      );
    }
  }

  // ---- 4c. 闸门不与静态固体重叠 ----
  for (const g of lv.gates) {
    for (let r = g.row; r < g.row + g.h; r++) {
      for (let c = g.col; c < g.col + g.w; c++) {
        check(at(c, r) === '.', `闸门 ${g.id} 与 (${c},${r}) 的静态地形重叠`);
      }
    }
    // 闸门下方要有地面
    check(
      ['#', ',', 'M'].includes(at(g.col, g.row + g.h)),
      `闸门 ${g.id} 下方没有地面（会漏过去）`
    );
  }

  // ---- 4d. 触发器所在格必须是空气且下方有地面 ----
  for (const t of lv.triggers) {
    check(at(t.col, t.row) === '.', `触发器 ${t.id} 位于非空气格 '${at(t.col, t.row)}'`);
    check(
      ['#', ',', 'M'].includes(at(t.col, t.row + 1)),
      `触发器 ${t.id} 悬空（下方 '${at(t.col, t.row + 1)}'）`
    );
  }

  // ---- 5. 危险池下方是地基 ----
  for (let r = 0; r < lv.height; r++) {
    for (let c = 0; c < lv.width; c++) {
      if ('fwa'.includes(at(c, r))) {
        check(r + 1 < lv.height, `危险池 (${c},${r}) 在最后一行`);
        if (r + 1 < lv.height) {
          const below = at(c, r + 1);
          check(below !== '.', `危险池 (${c},${r}) 下方是空气，会掉出世界`);
        }
      }
    }
  }

  // ---- 6. 物理模拟：从出生点自由落体 2 秒 ----
  const state = createGameState(lv);
  const input = new Input();
  let died = false;
  for (let i = 0; i < 120; i++) {
    stepWorld(state, input, {}, 1 / 60);
    if (state.status === 'dead') { died = true; break; }
  }
  check(!died, `自由落体 2 秒内不应该死亡（state.status=${state.status}）`);
  if (!died) {
    for (const p of state.players) {
      check(p.onGround, `${p.kind} 2 秒后应该站在地面上`);
      check(
        p.y + p.h <= lv.height * TILE_SIZE,
        `${p.kind} 掉出了世界底部（y=${p.y.toFixed(1)}）`
      );
    }
  }
  console.log(
    `    落体测试：fire y=${state.players[0].y.toFixed(1)} onGround=${state.players[0].onGround}` +
    `  water y=${state.players[1].y.toFixed(1)} onGround=${state.players[1].onGround}`
  );
}

// ---- 跳跃参数体检 ----
const jumpHeight = (PHYSICS.jumpVelocity * PHYSICS.jumpVelocity) / (2 * PHYSICS.gravity);
const airTime = (2 * Math.abs(PHYSICS.jumpVelocity)) / PHYSICS.gravity;
const jumpDist = airTime * PHYSICS.moveSpeed;
console.log('\n=== 物理参数 ===');
console.log(`  跳跃高度 ${jumpHeight.toFixed(1)}px = ${(jumpHeight / TILE_SIZE).toFixed(2)} 格`);
console.log(`  滞空 ${airTime.toFixed(3)}s，水平位移 ${jumpDist.toFixed(0)}px = ${(jumpDist / TILE_SIZE).toFixed(2)} 格`);
console.log(`  → 可跨越 ${Math.floor((jumpDist - PHYSICS.charW) / TILE_SIZE)} 格宽的坑`);
console.log(`  → 可跳上 ${Math.floor(jumpHeight / TILE_SIZE)} 格高的平台`);
check(jumpHeight > 3 * TILE_SIZE, '跳跃高度应 > 3 格，否则关卡里的台阶上不去');
check(jumpHeight < 4 * TILE_SIZE, '跳跃高度应 < 4 格，否则 5 格闸门形同虚设');
check(jumpDist > 4 * TILE_SIZE + PHYSICS.charW, '应能跨越 4 格坑');
check(jumpDist < 5 * TILE_SIZE, '应跨不过 5 格坑，否则酸池机关失效');

console.log(failures === 0 ? '\n✅ 全部关卡体检通过' : `\n❌ 共 ${failures} 项未通过`);
process.exit(failures === 0 ? 0 : 1);

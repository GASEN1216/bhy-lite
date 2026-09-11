# 冰火双人行 · Fire & Water Lite

一个从零构建的**类森林冰火人（Fireboy & Watergirl）双人同屏 2D 解谜平台游戏**。
纯单机、零运行时依赖（只有 4 个 devDependencies），可直接部署到 **GitHub Pages** 在线游玩。

- **技术栈**：TypeScript + Vite + 原生 Canvas 2D，包管理用 pnpm
- **渲染**：自研 Canvas 2D 渲染器 + 自研离散 AABB 物理引擎（无 Phaser，原因见下方 FAQ）
- **素材**：全部由代码程序化生成（像素 PNG + 8-bit WAV），原创 CC0，见 [ASSET_LICENSES.md](./ASSET_LICENSES.md)
- **测试**：39 个 Vitest 单元测试（含一个会自己把第 1 关打通的端到端 AI 测试）+ 关卡体检脚本
- **许可**：MIT

---

## 目录

- [快速开始](#快速开始)
- [操作说明](#操作说明)
- [玩法与关卡机制](#玩法与关卡机制)
- [项目结构](#项目结构)
- [架构与模块](#架构与模块)
- [关卡数据格式](#关卡数据格式)
- [测试](#测试)
- [部署到 GitHub Pages](#部署到-github-pages)
- [素材来源与许可](#素材来源与许可)
- [FAQ](#faq)

---

## 快速开始

```bash
# 1. 安装依赖
pnpm install

# 2. 本地开发（默认 http://localhost:5173）
pnpm dev

# 3. 生产构建（产物在 dist/）
pnpm build

# 4. 本地预览生产构建
pnpm preview
```

> **两个已预先规避的 pnpm 坑**（都写在 `pnpm-workspace.yaml` 里，一般无需手动处理）
>
> 1. **Windows 未开启「开发者模式」**：pnpm 创建软链接会失败（`os error 2`）。
>    已设置 `nodeLinker: hoisted` 使用扁平 node_modules，不建软链接。
> 2. **pnpm 10+/12 默认禁止依赖执行构建脚本**，而 Vite 依赖的 esbuild 需要它。
>    已设置 `allowBuilds: esbuild: true` 放行。
>    若你的 pnpm 版本不认这些字段，改用命令行：
>    `pnpm install --config.node-linker=hoisted --config.dangerously-allow-all-builds=true`
>    （CI 里已经带了后一个参数兜底）。

其他脚本：

| 命令 | 说明 |
| --- | --- |
| `pnpm gen:assets` | 重新生成 `public/assets/` 下的全部像素图与音效 |
| `pnpm verify:levels` | 关卡体检：打印 ASCII 关卡预览 + 结构性/可玩性断言 |
| `pnpm test` | 运行 Vitest 单元测试 |
| `pnpm typecheck` | 仅做 TypeScript 类型检查 |

---

## 操作说明

同一台键盘、两个人同时操作：

| 角色 | 左 | 右 | 跳 |
| --- | --- | --- | --- |
| 🔥 **火男** | `←` | `→` | `↑` 或 `Space` |
| 💧 **水女** | `A` | `D` | `W` |

全局按键：

| 按键 | 功能 |
| --- | --- |
| `Esc` | 暂停 / 继续 |
| `R` | 重开本关 |
| `1`~`5` | 主菜单 / 结算界面直接跳关（需已解锁） |

**过关条件**：火男站进火门、水女站进水门，且**两人同时在门内**才算通关。

---

## 玩法与关卡机制

### 元素地形

| 地形 | 火男 | 水女 |
| --- | --- | --- |
| 🔥 **火池** | 免疫，可直接趟过 | **死亡** |
| 💧 **水池** | **死亡** | 免疫，可直接趟过 |
| ☠️ **酸池（绿）** | **死亡** | **死亡** |

死亡后 0.85 秒自动回到出生点重开本关，宝石也会复原（机关拉杆状态保留、按钮状态清空）。

### 收集与评分

- 红色宝石只能由**火男**收集，蓝色宝石只能由**水女**收集。
- 结算星级：
  - ★ 通关即得 1 星
  - ★ 收集**全部**宝石 +1 星
  - ★ 用时 ≤ 关卡 `twoStarTime`（第 1 关是 20 秒）+1 星
- 各关最佳用时 / 星级 / 宝石数保存在 **localStorage**（key：`bhy-lite-save-v1`）。
- 通关一关自动解锁下一关。

### 机关

| 机关 | 行为 |
| --- | --- |
| **拉杆 (lever)** | 边缘触发：踩上去**切换**一次状态，状态会**保持**（人走开也不变） |
| **按钮 (button)** | 需要**持续**站人（或压箱子）才有效，离开即复位 |
| **闸门 (gate)** | 默认实心挡路；任一关联触发器激活时打开（可通过 `invert` 反转） |
| **横向平台** | 沿 X 轴往返移动，`auto` 模式一直跑，`trigger` 模式只在触发器激活时跑 |
| **升降台** | 沿 Y 轴往返移动，同上 |
| **木箱** | 可推动（速度比走路慢），会掉落，能压住按钮；掉进池子会消失并在 1.4 秒后回到原位 |

### 五个关卡

| # | 名称 | 教学点 |
| --- | --- | --- |
| 1 | **初次相遇** | 移动 / 跳跃 / 元素地形 / 宝石 / 终点门 |
| 2 | **拉杆高台** | 拉杆 → 横向平台过酸池；拉杆 → 升降台上高台 |
| 3 | **按钮之门** | 两人轮流按住按钮，让对方穿过闸门 |
| 4 | **推箱压阵** | 把箱子推上按钮让闸门长开；升降台上高台 |
| 5 | **双人舞步** | 自动往返平台 + 按钮配合 + 箱子压按钮 + 升降台，综合关 |

---

## 项目结构

```
bhy-lite/
├── index.html                  # 入口 HTML（canvas + UI 挂载点）
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts              # ★ base 路径适配 GitHub Pages 子路径
├── .npmrc                      # pnpm 安装相关说明
├── .gitignore
├── LICENSE                     # MIT
├── README.md
├── ASSET_LICENSES.md           # ★ 素材来源与许可清单
├── .github/
│   └── workflows/
│       └── deploy.yml          # ★ push main → 自动构建部署 GitHub Pages
├── public/
│   ├── .nojekyll               # 让 GitHub Pages 不要忽略 _ 开头文件
│   └── assets/                 # ★ 全部素材（程序生成）
│       ├── images/  tiles.png actors.png objects.png doors.png
│       └── audio/   bgm.wav jump.wav gem.wav ... (10 个)
├── scripts/
│   ├── gen-assets.mjs          # 素材生成器
│   ├── verify-levels.ts        # 关卡体检脚本
│   └── lib/
│       ├── pixel.mjs           # 极简 RGBA 位图 + PNG 编码器
│       └── audio.mjs           # 极简合成器 + WAV 编码器
├── src/
│   ├── main.ts                 # 入口：串起所有子系统 + 主循环
│   ├── styles.css
│   ├── core/
│   │   ├── constants.ts        # ★ 调参与资源路径单一入口
│   │   ├── types.ts            # 领域类型
│   │   └── math.ts             # 几何 / AABB 工具
│   ├── engine/
│   │   ├── input.ts            # 键盘输入
│   │   ├── loop.ts             # 固定步长游戏循环
│   │   ├── physics.ts          # ★ 离散 AABB 碰撞解算（子步 + MTV）
│   │   ├── camera.ts           # 双角色跟随 + 自动缩放
│   │   ├── audio.ts            # 音量分档的音频管理器
│   │   └── assets.ts           # 资源加载（失败有兜底）
│   ├── game/
│   │   ├── level.ts            # 关卡数据 → 运行时状态
│   │   ├── levels.ts           # ★ 5 关关卡数据（ASCII 配置）
│   │   ├── world.ts            # ★ 世界仿真 step
│   │   ├── render.ts           # Canvas 2D 渲染
│   │   ├── scoring.ts          # 三星评分
│   │   └── save.ts             # localStorage 存档
│   └── ui/
│       └── overlay.ts          # DOM 浮层：菜单 / 选关 / HUD / 暂停 / 设置 / 结算
└── tests/                      # Vitest 单元测试（39 个）
    ├── math.test.ts            # AABB / MTV
    ├── physics.test.ts         # 碰撞解算
    ├── levels.test.ts          # 关卡结构
    ├── mechanisms.test.ts      # 拉杆 / 按钮 / 闸门 / 平台 / 推箱
    ├── scoring.test.ts         # 星级 + 关卡解析
    ├── save.test.ts            # 存档
    ├── world.test.ts           # 重力 / 元素相克 / 死亡复位
    └── playthrough.test.ts     # ★ AI 自动通关第 1 关（端到端）
```

---

## 架构与模块

数据流是一条单向管线：

```
Input ──► stepWorld(state, input, hooks, dt) ──► GameState ──► Renderer.draw(state)
                      │                                            │
                      └─► hooks.playSfx / onEvent ──► Audio / UI   └─► UI.updateHud(state)
```

`stepWorld` 每帧固定顺序（顺序本身很重要）：

```
0. 死亡 / 暂停 / 通关 状态处理
1. 触发器（拉杆边缘触发、按钮持续触发） → 返回 active 表
2. 闸门：根据 active 表更新 solid
3. 移动平台：推进相位 → 计算位移 → 把骑乘者一起传送（applyCarry）
4. 箱子：重力 → 碰撞 → 危险池 → 复活计时
5. 角色：输入→速度 → 跳跃(coyote+buffer) → 重力 → 碰撞 → 推箱 → 危险 → 宝石 → 门
6. 终点门动画
7. 通关检测（两人同时在门内）
8. 摄像机
```

### 关键设计

- **两个角色互不碰撞**：给每个角色的碰撞体打 `group`（火男 11 / 水女 22），
  物理层里同 group 直接跳过 —— 因此可以重叠、可以穿过对方。
- **移动平台不抖**：平台先算出位移 → 用 `applyCarry()` 把站在上面的角色 / 箱子
  按同样位移平移并解算，再提交平台位置。角色的 `ride.id` 由上一帧落地时记录。
- **确定性**：`FIXED_DT = 1/120`，物理只接受固定 dt，因此同输入必得同结果，单测可靠。
- **纯函数优先**：`math.ts` / `physics.ts` / `scoring.ts` / `save.ts` 全部可在 Node 里跑，
  不依赖任何浏览器 API。

---

## 关卡数据格式

关卡是**纯数据配置**（`src/game/levels.ts`），用 ASCII 图 + 机关数组描述，方便扩展。

```ts
const LEVEL_1 = buildLevel({
  id: 1,
  name: '初次相遇',
  hint: '火男怕水、水女怕火、酸池两人都死。',
  twoStarTime: 20,   // 用时 ≤ 20s 且拿到全部宝石 → 3 星
  map: `
........................................   ← 40 列 × 20 行
........................................
..F.W...r......b......r.....b......D.d..
###########www###fff####aaa#############
########################################
`,
  triggers: [ { id: 'lever-a', kind: 'lever', col: 8, row: 16, targets: ['plat-a'] } ],
  movingPlatforms: [ { id: 'plat-a', col: 14, row: 17, w: 2, h: 1, axis: 'x',
                       distance: 3, speed: 80, mode: 'trigger', targets: ['lever-a'] } ],
  gates: [ { id: 'gate-a', col: 20, row: 12, w: 1, h: 5, targets: ['btn-a'] } ],
});
```

图例（完整版见 `src/game/levels.ts` 头部注释）：

| 字符 | 含义 | 字符 | 含义 |
| --- | --- | --- | --- |
| `#` `,` `M` | 石头 / 泥土 / 金属（固体） | `F` `W` | 火男 / 水女出生点 |
| `f` | 火池（火男免疫） | `D` `d` | 火门 / 水门 |
| `w` | 水池（水女免疫） | `r` `b` | 红宝石 / 蓝宝石 |
| `a` | 酸池（两人都死） | `o` | 可推木箱 |
| `.` | 空气 | | |

**新增一关**：在 `src/game/levels.ts` 里追加一个 `buildLevel({...})` 并加进
`LEVELS` 数组即可；然后跑 `pnpm verify:levels` 做体检（会检查尺寸、出生点悬空、
机关 id 悬空引用、危险池漏底、升降台通道被挡、横向平台两端有没有岸等）。

---

## 测试

```bash
pnpm test          # 单次运行
pnpm test:watch    # 监听模式
pnpm verify:levels # 关卡体检（非单测，独立脚本）
```

覆盖情况：

| 测试文件 | 覆盖内容 |
| --- | --- |
| `math.test.ts` | clamp / lerp / AABB 相交 / 最小平移向量 MTV 的方向正确性 |
| `physics.test.ts` | 落地、撞墙速度清零、分组忽略、高速子步不穿墙、承载位移 |
| `levels.test.ts` | 5 关结构校验、地形元素统计、GameState 构造 |
| `mechanisms.test.ts` | 拉杆边缘触发与状态保持、按钮持续触发、闸门开合、平台行程边界、推箱、升降台载人与 id 引用完整性 |
| `scoring.test.ts` | 星级计算、关卡 ASCII 解析 |
| `save.test.ts` | 存档解锁链、最佳成绩保留更小值、设置持久化 |
| `world.test.ts` | 落体稳定站立、跳跃负速度、元素相克致死/免疫、死亡自动复位 |
| `playthrough.test.ts` | **端到端**：内置 AI 用真实按键输入把第 1 关打通（约 4.7 秒、宝石全收），一次性验证 输入→物理→跳跃→元素相克→宝石→终点门→通关 全链路 |

---

## 部署到 GitHub Pages

### 1. 创建仓库并推送

```bash
git init
git add .
git commit -m "feat: 冰火双人行 MVP"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 2. 开启 Pages

仓库 **Settings → Pages → Build and deployment → Source** 选 **GitHub Actions**。
（`.github/workflows/deploy.yml` 已经写好，push 到 `main` 会自动构建并部署。）

### 3. base 路径

GitHub Pages 的地址是 `https://<user>.github.io/<repo>/`，所以生产构建必须把
`base` 设成 `/<repo>/`。已内置自动推导（`vite.config.ts`）：

```ts
const REPO_NAME = 'bhy-lite';              // ← 本地回退用的仓库名
function resolveBase(): string {
  if (process.env.BASE_PATH) return withSlashes(process.env.BASE_PATH);
  const ghRepo = process.env.GITHUB_REPOSITORY;   // CI 里形如 "owner/repo"
  if (ghRepo?.includes('/')) return withSlashes(ghRepo.split('/')[1]);
  return '/';                                     // 本地 dev / preview
}
```

- **CI 里**自动从 `GITHUB_REPOSITORY` 取仓库名，无需手改。
- **本地**是 `/`，`pnpm dev` / `pnpm preview` 正常工作。
- 如果你的仓库名不叫 `bhy-lite`，改 `vite.config.ts` 里的 `REPO_NAME` 常量，
  或构建时传 `BASE_PATH=/你的仓库名/ pnpm build`。
- 运行时资源路径统一由 `src/core/constants.ts` 里的 `ASSETS` 常量 +
  `import.meta.env.BASE_URL` 拼接，**不会**出现子路径 404。

### 4. 验证

Actions 页面看到绿色对勾后，访问：

```
https://<你的用户名>.github.io/<仓库名>/
```

---

## 素材来源与许可

- **代码**：MIT，见 [LICENSE](./LICENSE)。
- **美术 / 音频**：全部由 `scripts/gen-assets.mjs` 程序化生成，原创，CC0 1.0。
  逐文件清单见 [ASSET_LICENSES.md](./ASSET_LICENSES.md)。
- 想换成 Kenney.nl / OpenGameArt / freesound 的素材？`ASSET_LICENSES.md` 末尾有替换步骤。

---

## FAQ

**Q：为什么没用 Phaser 3？**
需求里 Phaser 是"优先"、Canvas 是备选。最终选了纯 Canvas，原因有三：

1. 本作几乎所有玩法（可推箱子、带骑乘的移动平台、闸门、按角色区分的元素免疫、
   两个角色互不碰撞）都需要**确定性的自定义 AABB 解算**；Phaser Arcade 在
   "移动平台带人"场景有已知的抖动/粘滞问题，绕开它反而要写更多代码。
2. 物理层变成纯函数后可以做真正的单元测试（"高速不穿墙"、"承载位移不动速度"等），
   这是 Phaser 内部求解器做不到的。
3. 零运行时依赖 → 产物 45 KB（gzip 15 KB），GitHub Pages 秒开。

引擎边界仍然清晰（`engine/` 与 `game/` 分离），换成 Phaser 只需替换 `render.ts`
与 `loop.ts`，`world.ts` / `physics.ts` / `levels.ts` 完全不用动。

**Q：能加更多关卡吗？**
能。在 `src/game/levels.ts` 追加 `buildLevel({...})` 并加进 `LEVELS`，
然后 `pnpm verify:levels` 体检。UI 的选关网格会自动渲染新关卡。

**Q：存档存在哪？**
`localStorage`，key 是 `bhy-lite-save-v1`（进度）和 `bhy-lite-settings-v1`（音量）。
清缓存/换浏览器会丢失，这是纯单机版本的预期行为。

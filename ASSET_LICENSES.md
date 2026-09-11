# 素材来源与许可 (ASSET_LICENSES)

> 本项目**没有**使用任何第三方美术 / 音频素材。
> 所有图片与音效都在构建时由 `scripts/gen-assets.mjs` **用代码程序化生成**，
> 因此全部为本项目原创内容，按 **CC0 1.0 Universal (Public Domain Dedication)** 释出。

## 生成方式

```bash
pnpm gen:assets     # 等价于 node scripts/gen-assets.mjs
```

脚本做的事：

| 文件 | 内容 | 生成方式 |
| --- | --- | --- |
| `public/assets/images/tiles.png` | 96×16 图块集（石头 / 泥土 / 火池 / 水池 / 酸池 / 金属） | `Raster` 逐像素绘制 + 噪点纹理，自研极简 PNG 编码器（zlib + CRC32） |
| `public/assets/images/actors.png` | 64×24 角色集（火男 / 水女 × 站立 / 行走） | 同上，几何图形组合 |
| `public/assets/images/objects.png` | 128×16 物件（红宝石 / 蓝宝石 / 拉杆 开关 / 按钮 开关 / 木箱 / 闸门块） | 同上 |
| `public/assets/images/doors.png` | 128×48 终点门（火门 / 水门 × 关闭 / 开启） | 同上 |
| `public/assets/audio/*.wav` | 9 个音效 + 1 段 8 秒循环 BGM | 自研合成器（方波 / 三角 / 锯齿 / 噪声 + ADSR 包络）→ 16-bit PCM WAV 编码器 |

PNG 编码器：`scripts/lib/pixel.mjs`
音频合成器 / WAV 编码器：`scripts/lib/audio.mjs`

## 素材清单与许可

| 路径 | 类型 | 作者 | 许可 |
| --- | --- | --- | --- |
| `public/assets/images/tiles.png` | 位图 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/images/actors.png` | 位图 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/images/objects.png` | 位图 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/images/doors.png` | 位图 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/bgm.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/jump.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/gem.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/death.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/lever.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/door.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/push.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/star.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/win.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |
| `public/assets/audio/ui.wav` | 音频 | 本项目（程序化生成） | CC0 1.0 |

## 代码许可

游戏源码（`src/`）与构建脚本（`scripts/`）采用 **MIT License**，见 [LICENSE](./LICENSE)。

## 如果你要替换成第三方素材

推荐来源（均为免费 / 可商用）：

| 站点 | 许可 | 适用 |
| --- | --- | --- |
| <https://kenney.nl/assets> | CC0 1.0 | 像素 UI / 平台 tileset / 音效包 |
| <https://opengameart.org> | 多为 CC0 / CC-BY / GPL（**需逐件核对**） | 角色、背景音乐 |
| <https://freesound.org> | CC0 / CC-BY（**需逐件核对**） | 音效 |
| <https://itch.io/game-assets/free> | 多为免费商用（需逐件核对） | 综合 |

替换步骤：

1. 把文件放进 `public/assets/` 下（建议保持 `images/` 与 `audio/` 两个子目录）；
2. 修改 `src/core/constants.ts` 里 `ASSETS` 常量（路径集中管理，只改这一处）；
3. 若图块尺寸 / 帧数变化，同步修改 `src/game/render.ts` 中的 sprite 索引；
4. 在**本文件**追加一行：路径、作者、原始链接、许可证名称，并保留原许可声明文件。

> ⚠️ 引入 CC-BY 等署名类素材时，必须在此处保留作者署名；引入 GPL 素材会传染本项目，请避免。

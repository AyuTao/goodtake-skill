# 双渲染引擎契约：HyperFrames 与 Remotion（含克制视频混剪与多模态原生审片）

本技能不绑定单一渲染工具，**原生支持 HyperFrames 与 Remotion 双渲染引擎**（亦可按需结合 Three.js 3D、GSAP 弹性物理动效、Manim 数学动画或纯 FFmpeg 管线）。阶段 0 向用户确认偏好，或按以下原则自动选型：

| 维度 | HyperFrames（默认轻量电影管线） | Remotion（React 组件化动效首选） |
|---|---|---|
| **技术栈** | 单 `index.html` + Canvas 2D / Three.js / GSAP | React + TypeScript + CSS/SVG/Canvas/Three.js |
| **最擅长场景** | 高频实时波形/数学仿真、粒子物理动画、AI 视频混剪、极速零依赖项目 | 复杂 UI/产品 App 界面动效复刻、物理弹簧排版（`spring()`）、组件复用与团队协作 |
| **视频轨道融合** | `<video>` 直属时间轴或由确定性帧引擎绘制 | `<OffthreadVideo src={staticFile(...)} />`（帧级精确防掉帧） |
| **音频混音** | 双路 `<audio>` 直属 `#root` | `<Audio src={staticFile("audio/vo_master.wav")} />` + `score_master.wav` |
| **确定性寻址** | `window.__timelines[id]` + `hf-seek` | `useCurrentFrame()` + `useVideoConfig()` 天然纯函数 |
| **渲染命令** | `npx --yes hyperframes@0.8.191 render --quality high` | `npx remotion render <CompId> renders/out.mp4 --codec=h264 --crf=18` |

---

## 一、克制用图与三大动态视觉介质规范

**核心原则：少用图片、非必要不生图！第一主力是纯代码程序真动画（60%–75%）+ 真实一手素材/App 截图（15%–25%）；AI 视频或概念原画仅克制用于全片 0–3 个核心奇观镜！**

### 1. 程序真动画（第一主力 · 60%–75%）
- 使用 Canvas 2D 实时演算、Three.js WebGL 3D 场景、GSAP 弹性时间轴、SVG `stroke-dashoffset` 路径生长或 Remotion `spring()` 物理动效，所有关键节点绑定 `syncCues` 毫秒级触发；
- 凡是原理推演、曲线、公式、流程图、示波器、数字撞击、信息对比能靠代码动起来的镜头，一律写代码真动画，绝不偷懒贴静态图。

### 2. 真实一手素材与 App 截图 / 实机录屏（15%–25%）
- 工具、产品、教程类视频优先展示真实 App 界面截图或实机录屏，可信度远超假概念图；
- 绝不把白底截图粗暴硬贴在黑屏上！统一包装为 **「暗房 3D 透视玻璃窗 + 柔和投影 + 移动聚光放大镜 / 翡翠高亮扫描框」**，只放大高亮当下旁白提到的真实区域，并自动打码隐私信息（邮箱、手机号、个人账号 ID）。

### 3. 核心奇观镜头按需调用 AI 视频模型（克制点睛 · 仅 0–3 个镜）
仅在全片真正不可替代的 0–3 个宏大意象或高潮定场点调用视频模型（4–6 秒/镜）：
- **本机冰爪视频生成网关（`generate_video` / `get_video_generation`）**：
  - `mode: "firstFrame"`（`model: "fasth3"`, `aspect: "landscape"`, `durationSeconds: 5`）：把已审验通过的 16:9 原画作为首帧，直接生成电影级流动运镜视频；
  - `mode: "firstLastFrame"`（`model: "minimax-h3"`）：把两张**同构图对比原画**分别作为首帧与尾帧，生成跨维形态演变视频；
  - `mode: "text"`：直接文生 16:9 电影空镜；
  - **异步铁律**：`generate_video` 提交后立即返回 `taskId`，生成通常需 1–10 分钟，期间只用 `get_video_generation(taskId)` 查询进度，**严禁换 `requestId` 重投**；
- **其他可用视频模型**：也可调用局域网 GPU 网关（如 ComfyUI Wan / LTX）、Veo、Kling、Seedance、Runway 等，统一转码为 `1920×1080 · 30fps · yuv420p` 无音轨垫片（音频交由主工程 96 BPM 交响与 Sound Design 统一掌控）。

---

## 二、HyperFrames 渲染铁律

1. **锁定版本**：`npx --yes hyperframes@0.8.191 <check|snapshot|render>`。
2. **根元素静态声明**：`#root` 显式写死 `data-composition-id`、`data-start="0"`、`data-duration`、`data-width="1920"`、`data-height="1080"`、`data-fps="30"`。
3. **双路母带 `<audio>` 直属 `#root`**：`vo_master.wav` 与 `score_master.wav` 音量在母带完成平衡，DOM 统一 `data-volume="1.0"`。
4. **独立底板 `.clip` + 零运行时 `fetch()`**：数据静态烘焙进 `assets/data/baked_data.js`；少量原画/真实截图在 DOM 中预加载并 `img.decode()`；AI 视频素材放于 `assets/videos/` 并按时间轴挂载。
5. **纯函数 `render(t)`**：严格由 `t` 决定，禁止 `Date.now()` / `Math.random()` 漂移。

---

## 三、Remotion 渲染铁律

当选用 Remotion 时，遵守同等院线级确定性标准：
1. **标准 Composition 注册**：在 `src/Root.tsx` 中注册 `width={1920} height={1080} fps={30}`，`durationInFrames={Math.round(totalDurationSec * 30)}`。
2. **全确定性驱动**：所有动效严格使用 `useCurrentFrame()`、`interpolate()`、`spring()`，严禁 CSS `transition` / `setInterval` / `Math.random()`（使用 `random(seed)`）。
3. **视频与音频轨道**：
   - AI 动态视频和 App 实机录屏必须使用 `<OffthreadVideo src={staticFile("videos/clip.mp4")} muted />`（保证逐帧解码确定性，绝不丢帧卡顿）；
   - 双路母带用 `<Audio src={staticFile("audio/vo_master.wav")} />` 与 `<Audio src={staticFile("audio/score_master.wav")} />`。
4. **复用同一套音画资产**：直接 `import` 由通用脚本生成的 `shots.json`、`cinema_beats.json`、`subtitles.json`，同样享受 **5ms 波形 VAD 字幕** 与 **96 BPM 交响微震**！

---

## 四、印刷级数学公式排版参考（Canvas / SVG / React 通用）

严禁使用歪斜的 Unicode 上标字符（`ˢ` `⁻` `¹`），统一使用基线偏移排版：
- **Canvas**：自定义 `drawMathFormula(ctx, segments, ...)` 将上标/下标用 `0.52×` 字号沿基线偏移 `-0.34×` / `+0.30×` 绘制；
- **Remotion / HTML**：使用 KaTeX 或 `<sup>`/`<sub>` 配合精确 `font-size: 0.54em; vertical-align: 0.45em`。

---

## 五、三道强制视听品控闸门（多模态原生整片看听优先！）

### 闸门 1：工程静态校验 + 独立防裁切封面四比例审计
1. 运行 `scripts/render_and_package.sh check`（HyperFrames 0 errors / Remotion `tsc --noEmit` 0 错误）；渲染前如不确定复杂页面排版，可快速 `snap` 少量关键帧排错。
2. 独立渲染无正片底部字幕的大字封面 `cover.jpg`（核心标题与主体锁死在中心 `750×780px` 安全框内），运行 `scripts/verify_cover_safezone.mjs <cover.jpg> <audit.jpg>`，**亲眼查看审计图**确认 `16:9 / 1:1 / 6:7 / 3:4` 全部一字不裁、不压右下角时长角标。

### 闸门 2：成品 1080p 渲染 + 双版本封装
运行 `scripts/render_and_package.sh render`，产出 1080p High 母带、`ffprobe` 音视频流参数校验以及 **H.264 High CRF 21 + AAC 192k + `-movflags +faststart`** 轻量高速发布版（~60–80 MB）。

### 闸门 3：成品 MP4 终极视听验收（按模型原生能力自动分级！）

> **核心原则：截图只能看静态排版，永远查不出动画掉帧、节奏拖沓、转场生硬、嘴型/人声与字幕毫秒级错位、以及配乐压过人声！具备原生视频+音频理解能力的模型，必须直接观看和聆听成品视频本身！**

1. **🥇 路线 A（首选 · 支持原生看视频与听音频的多模态 Agent，如 Google Antigravity / Gemini 等）**：
   - 直接使用文件读取/多模态视频工具读取成品 `.mp4`（整片从头看到尾、从头听到尾）；
   - 若成品 MP4 超过模型单文件体积上限或时长限制，立刻运行：
     ```bash
     scripts/render_and_package.sh review-prep renders/<slug>-master.mp4 /tmp/cinema_review 75
     ```
     自动生成 **720p 轻量化整片审片版（`review_full_720p.mp4`，约 15–25 MB，保留原始完整音轨）** 以及 **75 秒无损分段（`review_part_01.mp4`, `02.mp4`...）**，逐段读入做到 **100% 全片视听无盲区覆盖**！
   - **7 项终审必检项**：
     1. **开场 15 秒钩子冲击力**：声音与画面是否瞬间抓住注意力、无平淡说明书感；
     2. **动画流畅度与运镜呼吸**：程序动画是否丝滑无卡顿、无超过 7.5s 的死顶静止画面；
     3. **转场与音效咬合**：闪白、黑切、200ms Drop 静默、BOOM 冲击是否精准卡在重拍和情绪转折点；
     4. **字幕毫秒级音画同步**：逐句核对开口即现、闭口即收，无提前抢跑、无拖尾残留、无错别字或遮挡正文；
     5. **配音与配乐人声平衡**：确认人声 1.0x 温润自然、无开头“咦”气口杂音或机械截断、交响高潮不压过人声；
     6. **防限流与事实零穿帮**：正片画面/字幕/口播零竞品平台名、公式基线齐整、App 截图隐私已脱敏；
     7. **片尾收束自然**：音乐尾音自然衰减、留白得当不突兀截断。
   - 发现任何视听瑕疵，必须精确记录时间戳（如 `01:24.3`）回炉修改并重新看听复检！

2. **🥈 路线 B（降级备用 · 仅限不支持原生视频输入能力的纯看图/纯文本 Agent）**：
   - 仅当当前模型架构不支持直接读入 `.mp4` 视频时，启用降级审计：
   - 运行 `scripts/render_and_package.sh snap` 从工程或成品抽取 **24 帧**并自动拼成 4 张 3×2 高清联系表，逐格核查排版、公式、截图锐度与字幕安全区；
   - 配合 FFmpeg 抽取首/中/尾多段混音 WAV 供听觉核验或声学响度/静音检测。

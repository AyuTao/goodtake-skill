---
name: goodtake
description: GoodTake（好镜头）电影级硬核科普/知识类短视频全流程制作与多平台自动发布技能（V2.3）：内置可复用的 styles/ 风格资产库（支持开拍前选调性、完工后一键询问沉淀为下次直接套用的专属风格），覆盖冰爪环境检测与未安装官网/macOS一键安装注册引导、资料缺口预检先问、多源一手交叉举证、反说明书顶级电影引子、深入浅出四层阶梯、防限流禁用竞品平台名合规、克制少图原则（主力纯代码程序真动画+真实App截图/一手素材+仅0-3个必要AI视频/原画奇观）、双模式音画节奏协同（代码原创配乐与关键动画/大标题双向同步设计，或用户指定音乐先分析节奏起伏再反推内容卡点）、全平台3:4/6:7/1:1/16:9防裁切黄金安全区独立封面设计与自动审计、1.0x温润配音、分段强制对齐+5ms波形VAD字幕、双渲染引擎（HyperFrames & Remotion原生自由切换）、多模态原生整片看听审片优先（无视频能力模型自动降级24帧联系表+抽音），到冰爪Iceonix防超时多平台发布与自动作者首评。支持国内外主流AI Agent（Claude Code/Antigravity/Cursor/Codex/WorkBuddy/豆包工作台/千问办公）。当用户要求“制作科普视频”“做一个电影感知识视频”“把热点/论文/工具做成高质量视频并发布”或手动调用 /goodtake 时触发。
argument-hint: "[选题/热点/文章路径 或 --style <风格名> + 视频需求说明]"
---

# GoodTake（好镜头）V2.3 · 电影级科普视频全流程制片厂

你是一位兼具**深度科普总编剧、事实核查官、院线纪录片总导演、声音设计师、动画/可视化工程师与全平台分发专家**能力的视频制作者。你拒绝一切“没查证就瞎编、说明书式平淡开头、堆砌一堆静态AI图平移、封面文字发到竖屏平台被裁掉一半、口播念竞品平台名被限流、音画各自为战不卡拍、错位飘移字幕”的敷衍做法，严格按照经过实战打磨的 **九阶段电影制片流水线（阶段 0 → 阶段 8 + 风格沉淀闭环）**，打造 16:9（1920×1080, 30fps）视听震撼、防裁切、防限流的硬核科普大片，并可通过冰爪（Iceonix）稳健分发多平台与自动挂首评。

> **设计哲学**：环境与资料缺口先检先问（未装冰爪主动贴心引导下载安装与注册），开拍前从 `styles/` 挑选视听调性，事实必须有铁证，开头绝不写“产品说明书”，正片绝不提竞品平台名防限流，**少用图片、非必要不生图**（主力做程序真动画与真实一手素材，仅在 0–3 个核心奇观镜用 AI 视频或原画），**音画节奏双模式深度协同**，**独立制作封面并把大标题死锁在中心防裁切安全区内**，渲染支持 HyperFrames / Remotion 自由切换，成片优先整片看听验收，发布防重复防超时，**完工后询问用户是否把本片调性存入 `styles/` 下次一键复用**！

---

## 前置环境与多引擎工具分工

| 环节 | 首选工具 | 并行/替代方案 |
|---|---|---|
| 事实调研 | `search_web` | 用户提供内部文档/数据 |
| **程序真动画（第一主力 · 60–75%）** | Three.js 3D、GSAP 物理动效、Remotion `spring()`、SVG 路径生长、Canvas 实时仿真 | Manim 数学动画、Blender 3D |
| **真实一手素材（15–25%）** | 用户提供的真实产品 App 截图/录屏、原始论文扫描、真实数据图 | 暗房 3D 透视玻璃框 + 移动聚光放大镜包装 |
| **AI 动态视频 / 概念原画（克制点睛 · 0–3 个奇观镜）** | 非必需不用！仅核心奇观用冰爪 `generate_video`（FastH3 / MiniMax H3）或 `generate_image` | Veo、Kling、Seedance、Wan、Sora |
| 1.0x 温润中文旁白 | 冰爪 `synthesize_speech`（本地 `voxcpm2` + 闭口纯净参考音） | 用户自录干声 / 其它高质量 TTS |
| 逐字强制对齐 + VAD 字幕 | 冰爪 `transcribe_video`（`qwen3`, `includeWords=true`, `referenceText`）+ `scripts/calibrate_subtitles_vad.mjs` | WhisperX（仍须经 5ms PCM VAD 校准） |
| 音画节奏协同与配乐 | **模式 A（原创同步）**：macOS Swift + CoreAudio 9 轨交响 + DSP（`scripts/compose_cinema_score.swift`）与内容/动画/标题同步设计<br>**模式 B（用户指定音乐）**：先用冰爪 `analyze_music` 或 `scripts/analyze_music_rhythm.mjs` 分析 BPM/鼓点/起伏，再反推内容与动画卡点 | 无版权分轨 / FFmpeg 动态侧链融合 |
| **16:9 确定性视频渲染（双引擎）** | **HyperFrames**（`hyperframes@0.8.191`，单 HTML 极速电影管线）或 **Remotion**（React/TS 组件化与 `<OffthreadVideo>` 动效首选） | 按阶段 0 偏好自由切换；均兼容 `scripts/render_and_package.sh` |
| 多平台发布与自动作者首评 | 冰爪 MCP（`create_project` → `update_project_publish_copy` → `batch_publish` / `publish_video`） | 仅输出成品 MP4 + 全平台发布文案包 |

---

## 九阶段标准制片流水线

每一阶段都带有强制验收闸门（Quality Gate），未通过验收不得进入下一阶段。

### 阶段 0：环境预检（含冰爪安装引导）与资料缺口“先问用户”闸门（Pre-Flight Intake）
收到请求后，**切忌环境不清、资料不全就直接闷头开工**！

1. **冰爪（Iceonix）环境快速预检与新手引导（详见 [references/iceonix-publish-playbook.md](references/iceonix-publish-playbook.md)）**：
   - 若任务需要本地高保真配音克隆（VoxCPM2）、逐字强制对齐（Qwen3）、AI 视频生成或多平台自动发布/首评，先检查当前是否已连上冰爪 MCP，或在终端只读运行 `${CLAUDE_SKILL_DIR}/scripts/setup_iceonix_macos.sh --check` 检测本机安装状态；
   - **若检测到用户尚未安装冰爪**：
     - **macOS 用户**：温和提示冰爪官网下载页（`https://iceonix.com/download/`），并主动询问：**「检测到你还没有安装冰爪（Iceonix），是否需要我直接帮你从官网自动下载最新正式版并安装到应用程序文件夹？装好后你只需打开冰爪注册/登录账号并扫码绑定平台，就能打通本地配音、对齐与全平台自动分发；如果暂时不想装，也可以先用纯本地模式把成品视频和发布文案包做出来。」**
     - **经用户明确同意后**：运行 `${CLAUDE_SKILL_DIR}/scripts/setup_iceonix_macos.sh --install`（从官方公证直链 `https://update.iceonix.com/iceonix/Iceonix.dmg` 自动下载安装并打开冰爪），随后提醒用户完成 **① 注册/登录账号（Apple / Google / GitHub）→ ② 扫码登录目标内容平台 → ③ 在冰爪里把 MCP 接入当前 Agent**，准备好回复即可继续；
     - **非 macOS 用户（Windows / Linux）**：提供官网 `https://iceonix.com/download/` 了解支持版本（Linux 企业版可运行 `curl -fsSL https://update.iceonix.com/linux/install.sh | bash`）并引导注册，同时支持纯本地无冰爪降级模式继续制作！

2. **划分「自己查的」与「必须先问用户的」**：
   - **自己查（不打扰用户）**：公开科技热点、一手论文/代码仓库、经典原理与学者评论。
   - **缺项必须先问用户（集中 1 轮精炼提问，最多 4–5 题且每题给默认推荐）**：
     1. **视觉风格与频道调性（`styles/` 资产库）**：先运行 `node ${CLAUDE_SKILL_DIR}/scripts/save_style_preset.mjs --list` 列出已有风格预设（默认内置「黑曜石熔金 IMAX」「深空蓝图极客」「胶片暖纸人文」以及用户曾保存的自定义风格），询问是直接套用某套已有风格还是为本期定制新调性；
     2. **私有素材 & 真实 App 截图/录屏**：若题材涉及某款 App、软件、工具或私有项目，主动索取真实 App 界面截图/录屏或内部核心数据（有真实界面特写，说服力翻十倍！）；
     3. **音乐与音画节奏模式**：是否自带**指定背景音乐**（模式 B：先分析音乐节奏起伏，再围绕起伏设计内容、关键动画与大标题卡点），还是由 AI **用代码同步原创配乐**（模式 A：默认推荐，内容/关键动画/大标题与交响音效同源同步设计）？
     4. **目标受众与时长**：零基础大众科普 vs 专业深度向？90s 极速钩子 vs 3.5–5 分钟全景电影版？
     5. **动态视觉、渲染引擎与发布偏好**：是否启用 AI 视频模型（I2V/T2V）给 0–3 个核心奇观镜加真实动态？渲染引擎选 **HyperFrames** 还是 **Remotion**？是否同步冰爪多平台发布？
   - **直通规则**：用户明确说“全权交给你发挥 / 按默认直接做”或已给齐所有材料时，不重复提问，按最佳配置直接推进。

### 阶段 1：多源交叉举证、顶级电影引子、深入浅出剧本与防限流自检
> 详见 [references/research-and-storytelling.md](references/research-and-storytelling.md) 与 [templates/research-and-script-brief.md](templates/research-and-script-brief.md)。

1. **三层证据链举证**：优先 **L1 一手铁证**（官方公告、原论文、GitHub 仓库、学会声明），再用 **L2 权威媒体与顶尖学者正反评价**交叉核验，严禁单采 L3 自媒体传言；输出带截止日期的《准确性红线清单》。
2. **反“说明书思维”顶级电影引子（黄金 15 秒）**：
   - **绝对禁止**“今天介绍一个工具 / 想象一份纯文本文件”这类枯燥工程师开场！前 8 秒绝不提“文件/工具名”；
   - 必须选用三大王炸电影开场结构之一：**① 磁带撕裂极致反差开场**（前 2.5s 故意演廉价死顶 PPT + 跑调电子琴 → 咔嚓撕裂骤停 → 42Hz BOOM 核爆切入震撼动态大片）、**② 成本与时间降维打击开场**、**③ 静默→极致尺度核爆开场**。
3. **深入浅出四层阶梯**：① 生活具象锚点 → ② 最小可验证实例 → ③ 同构画面类比 → ④ 幕间因果悬念链。
4. **全平台防限流铁律（必须过筛！）**：正片**口播、字幕、画面文字、封面与通用作者首评中，严禁出现任何具体社交/视频平台名字**（严禁说或写抖音、小红书、视频号、B站、快手、头条、YouTube、X），统一用「**各大主流内容平台 / 全网多平台一键分发 / 评论区自动置顶首评**」替代，彻底避免跨平台竞品词限流！

### 阶段 2：克制视觉资产筹备（程序动画为主、少用图片、真实素材优先）
> 详见 [references/director-bible.md](references/director-bible.md)。

1. **克制少图原则（核心升级）**：**能用纯代码程序动画（Three.js / Remotion `spring()` / Canvas / SVG）或真实截图表达清楚的，一律不生图！** 严禁无脑堆砌 10+ 张 AI 静态图平移充数。
2. **真实一手素材与 App 截图优先**：工具/软件/教程类视频优先收集真实产品 App 截图、实机录屏或一手论文扫描件，在引擎中用**暗房 3D 透视玻璃框 + 局部聚光放大镜 + 隐私打码**高级包装。
3. **仅在 0–3 个核心奇观镜使用 AI 视频或概念原画**：只对全片真正不可替代的 0–3 个宏大意象/高潮节点生成统一光影原画，且优先调用冰爪 `generate_video`（`firstFrame` 图生视频 / `firstLastFrame` 首尾帧变形）让画面真正动起来；所有生成图/视频必须亲眼审验零文字乱码。

### 阶段 3：1.0x 纯净温润配音、音乐起伏预分析与节拍母带装配
> 详见 [references/audio-and-sync-guide.md](references/audio-and-sync-guide.md)。

- **若走模式 B（用户指定音乐 · 音乐节奏先行！）**：**在装配母带和写分镜之前**，先调用冰爪 `analyze_music` 和/或运行 `${CLAUDE_SKILL_DIR}/scripts/analyze_music_rhythm.mjs <music_path> assets/data/cinema_beats.json`，提取指定音乐的 **BPM、全部拍点、强鼓点/Drop 爆点与全曲情绪起伏分段（`calm / build / climax / release`）**；后续每一幕口播留白、大标题撞击与关键程序动画均严格贴合这份音乐起伏地图编排！
- **若走模式 A（代码原创配乐 · 音画同步设计！）**：确立全片统一节拍网格（如 96 BPM 整小节）与情绪弧线，让旁白停顿、核心大标题、关键动画节点与后续代码交响作曲共享同一份 `timeline.json` + `syncCues` 戏剧锚点。
- **纯净人声铁律**：克隆人声必须使用**完整闭口收音 + 纯净尾静音**的参考音，杜绝分段“咦”气口杂音；严格保持 **1.0x 原速不加速**；运行 `${CLAUDE_SKILL_DIR}/scripts/assemble_vo_timeline.mjs` 装配冻结母带 `vo_master.wav` 与 `timeline.json`，**亲耳抽听**首、中、尾至少 3 段验货。

### 阶段 4：分幕强制对齐 + 5ms 真实波形 VAD 字幕校准 & 节拍卡点分镜表
1. 对每一幕独立干声分别跑强制对齐（避免千字截断与吞噬段间静音）。
2. 运行 `${CLAUDE_SKILL_DIR}/scripts/calibrate_subtitles_vad.mjs`，用 **5ms PCM 波形 RMS 包络（-40 dBFS）** 夹紧每句起止毫秒，输出零重叠、零提前、零拖尾的 `subtitles.json`（35ms 出入淡显）及毫秒级 `syncCues`。
3. 编排 **50–70 个独立电影镜头** `shots.json`（平均 `4.0–5.5s/镜`，单镜严禁死顶超过 `7.5s`）：
   - **模式 B（指定音乐）**：把最炸的**大标题砸屏、关键动画核心揭晓与闪白转场**直接卡在 `cinema_beats.json` 的 `drops[]` 与 `climax` 段落上，安静段（`calm`）承接密集科普讲解与温和推演；
   - **模式 A（代码原创配乐）**：在 `shots.json` 显式标出 `flash_cut` / `drop_boom` / `hard_black` 与 `titleHits` / `animTriggers` 节点，交给阶段 5 的代码作曲引擎为每个关键动画和大标题精准写音乐与音效！

### 阶段 5：双模式配乐混音与好莱坞 Sound Design
- **模式 A（代码原创交响 · 默认）**：运行 `${CLAUDE_SKILL_DIR}/scripts/compose_cinema_score.swift`，读取 `timeline.json`、`shots.json` 与 `syncCues`，**围绕内容情绪、关键动画触发点与大标题砸屏点直接用代码谱写** 96 BPM 9 轨 CoreAudio 交响乐团 + 好莱坞音效（42Hz BOOM、空气吸气 Riser、200ms 窒息静默 Drop、快门咔嗒、钟琴/划切）+ 实时人声包络平滑侧链避让，同步导出 30fps `cinema_beats.json`。
- **模式 B（用户指定音乐融合）**：保留用户指定音乐的完整律动起伏，用 FFmpeg `sidechaincompress` 在人声活跃期自动平滑避让、无声空隙与大标题/关键动画处推回满动态，并可按需在 `drops[]` 叠入极克制的转场微音效；直接复用阶段 3 产出的 30fps `cinema_beats.json` 驱动视觉微震与眩光呼吸。
- 无论哪种模式，完成后均导出 3 段真实 VO + 音乐混音**亲耳试听验收**。

### 阶段 6：双渲染引擎（HyperFrames / Remotion）16:9 电影合成
> 双引擎完整技术契约见 [references/render-engines.md](references/render-engines.md)。

- **选用 HyperFrames**：静态烘焙数据（零运行时 `fetch`）、DOM 原画预解码、AI 视频轨道挂载、直属 `#root` 双路 `<audio>`、`window.__timelines` + `hf-seek` 纯函数确定性渲染；
- **选用 Remotion**：React/TypeScript 组件化动效、`useCurrentFrame()` + `spring()`、`<OffthreadVideo muted />` 精确融合 AI 动态视频与 App 录屏、`<Audio>` 挂载双路母带，同样消费 `shots.json` / `cinema_beats.json` / `subtitles.json`；
- 数学公式一律采用 **LaTeX 出版级基线排版**（严禁歪斜 Unicode 上标），底部电影字幕采用无丑黑条的纯白双轮廓影院排版。

### 阶段 7：契约校验、防裁切独立封面、双版本打包与多模态整片“看+听”终审
1. **工程静态校验**：运行 `${CLAUDE_SKILL_DIR}/scripts/render_and_package.sh check <project> --engine <hyperframes|remotion>` 确保 0 错误；渲染前如不确定排版，可先抽查少量关键帧快速排错。
2. **独立设计全平台防裁切专属封面（严禁随手截正片带字幕帧！）**：
   - 单独渲染 `cover.jpg`（`1920×1080`，无正片底部字幕），将 **2–3 行大字主标题（每行 4–7 字）与核心视觉焦点全部锁死在中心 `750 × 780 px`（`x ∈ [585, 1335]`, `y ∈ [140, 920]`）黄金安全区内**，彻底避开右下角时长角标；
   - 运行 `${CLAUDE_SKILL_DIR}/scripts/verify_cover_safezone.mjs <cover.jpg> <audit.jpg>` 生成 **`16:9` / `1:1` / `6:7` / `3:4` 四种平台真实裁切模拟审计图**，**亲眼审验确认所有平台裁切下标题一字不丢**！
3. **正式渲染与双版本封装**：运行 `render_and_package.sh render` 导出 1080p High 母带、自动 `ffprobe` 校验并自动压制 **CRF 21 + faststart 轻量高速发布版（~60–80 MB）**。
4. **成片终极视听审片（分级策略：能直接看视频就整片看听，不能看才降级截图！）**：
   - **🥇 优先路径（多模态原生视频/音频模型，如 Antigravity / Gemini 等）**：**严禁偷懒只看几张截图敷衍验收！** 直接读取渲染完成的整支 `.mp4` 成品（若单文件超模型体积或时长限制，先运行 `render_and_package.sh review-prep <master.mp4>` 生成 720p 轻量化整片审片版或 75 秒分段，从头到尾全片覆盖），**亲眼观看完整动态画面、亲耳聆听完整人声与配乐混音**！同步审查：镜头动态连贯性、转场节奏与呼吸感、口播情绪与停顿、交响侧链人声清晰度、字幕毫秒级音画咬合、公式与布局零穿帮。发现瑕疵必须立刻回炉重修重验！
   - **🥈 降级路径（仅限不支持原生视频理解的模型）**：若当前运行模型无法直接读取视频文件，才降级运行 `render_and_package.sh snap` 截取 **24 帧**拼成高清 3×2 联系表逐格审查画面 + 提取首/中/尾多段 WAV 亲耳（或声学指标）核查音画同步与响度。

### 阶段 8：全平台差异化文案、冰爪防超时批量发布与自动作者首评
> 详见 [references/iceonix-publish-playbook.md](references/iceonix-publish-playbook.md) 与 [templates/publish-copy-template.md](templates/publish-copy-template.md)。

1. 生成各平台隔离专属文案与无链接作者首评（通用短标题 ≤ 16 字零禁用标点，全平台勾选 `ai_generated`，视频号默认原创）。
2. 新生成文案或未确认平台时，向用户**集中确认一次**再真实发布。
3. 标准流程：`create_project` → `update_project_publish_copy`（挂载自动作者首评）→ 复用 `projectPath` 用 CRF 21 轻量版按**每批 2 个平台**串行 `batch_publish`（彻底破解 3 分钟 MCP 超时墙！）；遇异常先只读 `get_project` 核验，绝不重发已成功平台。
4. **完工风格一键沉淀闭环（必问！）**：在整支视频交付（或发布完成）后，主动询问用户：**「这版视频的配色光影、字幕字体、剪辑节奏、配乐调性和封面风格你满意吗？要不要把它存进 `styles/` 风格库（起一个名字，下次拍新视频直接套用保持统一频道感）？」** 若用户同意，将本片的完整视听参数（脱敏、不含私密路径）通过 `node ${CLAUDE_SKILL_DIR}/scripts/save_style_preset.mjs --save <style.json> --id <slug>` 写入 `${CLAUDE_SKILL_DIR}/styles/<slug>.json`！

---

## 绝对不可违背的 8 条红线

1. **绝不盲目开工、绝不瞎编事实**：私有素材/App 截图/核心需求不齐先集中问清；事实须经 L1/L2 交叉举证。
2. **绝不写说明书式弱引子**：前 8 秒禁提“工具/文件”，必用极致反差、成本降维或尺度赌注引爆前 15 秒。
3. **绝不在正片与通用首评出现竞品平台名**：防全网跨平台关键词限流！
4. **绝不滥用静态图片充数**：少用图片、非必要不生图！主力做程序真动画与真实一手素材，仅 0–3 个核心奇观镜用 AI 视频或原画，平均每镜 4.0–5.5 秒。
5. **绝不让封面标题在任何平台被裁切**：封面独立渲染，主标题与主体必须锁死在中心 `750×780px`（`3:4` 内接安全框）内，且必须跑 `verify_cover_safezone.mjs` 亲眼过四比例裁切审计！
6. **绝不凑合漂移字幕**：必经分幕独立强制对齐 + 5ms PCM 波形 VAD 夹紧校准。
7. **绝不盲渲交付、能整片看听就绝不只看截图**：配音、交响混音、四比例封面审计图必须亲检；最终成品 MP4 须由原生多模态模型直接**整片看+听**审查音画字幕同步与动效节奏（仅不支持看视频的模型才降级用 24 帧联系表 + 抽音）。
8. **绝不违规发布**：未授权不传 `confirmPublish: true`；不重发已成功平台；不操作/重启冰爪进程；首评不带链接或导流词。

---

## 参考文档与可执行资产索引

- 资料预检、举证、顶级引子与防限流指南：[references/research-and-storytelling.md](references/research-and-storytelling.md)
- 导演美学、克制少图原则与全平台防裁切封面圣经：[references/director-bible.md](references/director-bible.md)
- 音画同步、5ms VAD 字幕与代码交响指南：[references/audio-and-sync-guide.md](references/audio-and-sync-guide.md)
- 双渲染引擎（HyperFrames & Remotion）与 AI 视频混剪契约：[references/render-engines.md](references/render-engines.md)
- 冰爪多平台防超时发布与首评手册：[references/iceonix-publish-playbook.md](references/iceonix-publish-playbook.md)
- 立项调研与剧本模板：[templates/research-and-script-brief.md](templates/research-and-script-brief.md)
- 分镜 JSON 契约模板：[templates/storyboard-schema.json](templates/storyboard-schema.json)
- 全平台发布文案与首评模板：[templates/publish-copy-template.md](templates/publish-copy-template.md)
- 风格资产库（预置 + 用户自定义沉淀）：[styles/README.md](styles/README.md)（含 `cinema-gold-imax.json`、`cyber-blueprint-lab.json`、`warm-editorial-essay.json`）
- 通用脚本库：`scripts/save_style_preset.mjs`、`scripts/setup_iceonix_macos.sh`、`scripts/analyze_music_rhythm.mjs`、`scripts/assemble_vo_timeline.mjs`、`scripts/calibrate_subtitles_vad.mjs`、`scripts/compose_cinema_score.swift`、`scripts/render_and_package.sh`、`scripts/verify_cover_safezone.mjs`

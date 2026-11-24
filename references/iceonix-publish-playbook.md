# 冰爪（Iceonix）环境引导、多平台防超时发布与作者首评实战手册

本手册覆盖**新用户冰爪安装与注册引导**，以及基于单次 4 条视频 × 5 大平台（共 20 次发布）100% 绿灯成功的真实经验提炼的 **MCP 3 分钟超时破解、作者首评自动挂载、平台标题截断、重复发布防雷与异常恢复** 等核心实战策略。

---

## 零、未安装冰爪时的环境检测、安装与注册引导（分享给新朋友必备！）

并不是每个使用本 Skill 的用户都已经安装了冰爪（Iceonix）。在阶段 0 或进入配音/对齐/发布环节前，必须先检测环境并给予贴心、克制、零越界的引导：

### 1. 只读检测当前环境
- 先检查当前对话是否已挂载冰爪 MCP 工具（如 `list_projects`、`list_platforms`、`synthesize_speech`）；
- 若未发现冰爪 MCP，在本地终端执行只读检测：
  ```bash
  ${CLAUDE_SKILL_DIR}/scripts/setup_iceonix_macos.sh --check
  ```

### 2. 分系统贴心引导（征得同意再行动，绝不私自安装！）
- **情况 A：macOS 用户，尚未安装冰爪（`ICEONIX_INSTALLED=false`）**
  1. 告知用户冰爪（Iceonix，官网 `https://iceonix.com`，下载页 `https://iceonix.com/download/`）负责本地高保真声音克隆、逐字强制对齐、AI 视频生成与多平台自动分发/自动作者首评；
  2. **先征得用户同意**再动手：「检测到你的 Mac 尚未安装冰爪，是否需要我直接从官网自动下载 Apple 公证最新正式版（`Iceonix.dmg`）并安装到 `/Applications/Iceonix.app`？」
  3. **用户同意后**，执行 `${CLAUDE_SKILL_DIR}/scripts/setup_iceonix_macos.sh --install`（自动从 `https://update.iceonix.com/iceonix/Iceonix.dmg` 下载、挂载、拷贝至 `/Applications/`、卸载清理并启动冰爪）；
  4. **引导用户完成 3 步初始化**：
     - **注册/登录账号**：在打开的冰爪客户端（或官网 `https://iceonix.com`）用 Apple、Google 或 GitHub 注册并登录冰爪账号；
     - **扫码绑定内容平台**：在冰爪内扫码登录你打算发布视频的平台账号（按需开启即可）；
     - **接入 MCP 到 AI Agent**：按冰爪内置的 Agent 接入提示，将冰爪 MCP 配置到当前使用的 AI Agent（如 Antigravity / Claude Code / Cursor / WorkBuddy 等），完成后告知 Agent「好了」即可无缝接续！
- **情况 B：macOS 已安装冰爪，但未接入 MCP 或未运行**
  - 提示用户手动打开 `/Applications/Iceonix.app`、确认已登录冰爪账号并开启 MCP 接入（遵守冰爪规范：**已安装状态下绝不擅自重启或终止冰爪进程**）。
- **情况 C：非 macOS（Windows / Linux）或用户暂不想安装冰爪**
  - 提供官方下载页 `https://iceonix.com/download/`（Linux 企业版主机官方安装命令：`curl -fsSL https://update.iceonix.com/linux/install.sh | bash`），并提醒前往官网注册账号；
  - **无冰爪纯本地降级模式依然完全可用**：继续完成资料调研、程序真动画渲染（HyperFrames / Remotion）、本地音频节奏分析（`analyze_music_rhythm.mjs`）或本地配乐、防裁切封面审计与全平台差异化发布文案包输出，用户拿到成品 MP4 与文案后可随时手动发布，或日后装好冰爪再一键分发！

---

## 一、发布前 4 项硬性检查

1. **防限流红线（严禁在正片与通用首评出现竞品平台名！）**：
   - 发往多平台的**共用视频正片（口播、字幕、画面文字）、封面与 `firstComments.default` 通用首评中，严禁出现任何具体平台名字**（如抖音、小红书、视频号、B站、快手、今日头条、YouTube、X），否则会触发各平台站外导流/竞品词降权限流！
   - 统一表述为「主流内容平台 / 全网多平台一键分发 / 评论区自动置顶首评」；具体平台名仅存在于后台 `platforms` 参数和对应平台专属文案中。
2. **遵守授权红线**：
   - 若文案、标题、作者首评是新生成或改动过的，或用户尚未明确目标平台，**先用清晰汇总表向用户确认一次**，得到确认后才传 `confirmPublish: true`。
2. **标题全平台兼容铁律**：
   - `batch_publish` 只有单一 `title` 参数；而各平台上限不同（**视频号 ≤ 16 字**、**小红书 ≤ 20 字**、**抖音/头条 ≤ 30 字**、B站 ≤ 80 字、YouTube ≤ 100 字）。
   - **最佳实战**：批量发布时的 `title` 统一控制在 **≤ 16 字**（精悍钩子），且**严禁包含书名号、引号、冒号、问号、感叹号、斜杠、括号和 Emoji**（全部用空格替代）；更完整的长标题和结构化介绍通过 `captions` 为每个平台单独定制！
3. **如实填写 AI 辅助声明**：
   - 视频含 AI 生图、AI 配音或代码辅助生成内容时，统一声明 `ai_generated`：
     - `wechatDeclaration: "ai_generated"` + `declareOriginal: true`（视频号原创默认开启）
     - `douyinDeclaration: "ai_generated"`
     - `xhsDeclaration: "ai_generated"`
     - `bilibiliDeclaration: "ai_generated"`
     - `kuaishouDeclaration: "ai_generated"`
   - 地理位置统一传 `location: "none"` 保护创作者隐私；`tags` 不含 `#`，最多 5 个。
4. **时长与平台硬限制检查**：
   - **X（普通账号）**：视频最长 **140 秒**，推文加权上限 **280 字符**（中文/Emoji 计 2，英文/数字计 1）；超过 140 秒的视频直接跳过 X！

---

## 二、标准“项目挂载作者首评 + 批量发布”两步法

> **核心知识**：`batch_publish` 本身不直接接收 `firstComments` 参数；想要批量发布同时自动挂上作者首评，必须先通过冰爪项目写入首评，再复用该项目的 `projectPath` 发布！

### Step 1：创建项目并装填首评（纯本地预备，不触发发布）
1. `create_project(title, summary)` → 获取 `projectId`、`revision`、`projectPath`。
2. `update_project_publish_copy(projectId, expectedRevision: revision, title, caption, tags, firstComments: { default: ["首评1", "跟评2"] })`：
   - 每个平台最多 3 条、每条 ≤ 500 字；第一条发成作者首评，后续依次跟评在它下面；
   - **严禁在首评中带链接、二维码或“看主页/私信”导流词**（带链接不会自动发）；
   - 写入即默认 `firstCommentAuto: true`：小红书、视频号、抖音会在作品过审且 Mac 空闲时自动发（视频号自动置顶）；B站与 YouTube 会在发布通知中保留文案供手动粘贴。

### Step 2：防 3 分钟 MCP 超时的“高速文件 + 2 平台小批”策略
> **血泪踩坑复盘**：一个 180 MB 视频在单个平台上传 + 转码 + 填写 + 提交通常耗时 70–110 秒。如果一次 `batch_publish` 塞进 5–7 个平台，必然突破客户端 3 分钟（180s）MCP 硬超时导致连接中断，正在提交的平台会被取消！

**100% 零超时实战配方**：
1. **视频体积瘦身**：优先上传经 CRF 21 + `+faststart` 压制的 **60–80 MB 高画质轻量版**（与 180 MB 原片肉眼无异，但上传快 2.5 倍，单平台降至 40–55 秒）。
2. **严格每批 2 个平台串行提交**：
   - 批次 A：`batch_publish(platforms: ["wechat", "douyin"], projectPath: <同项目路径>, requestId: "<id>-a", ...)`（~90–140s 稳过！）
   - 批次 B：`batch_publish(platforms: ["xhs", "bilibili"], projectPath: <同项目路径>, requestId: "<id>-b", ...)`（~110–150s 稳过！）
   - 批次 C：若剩余 2 个平台（如 `["youtube", "x"]`）用 `batch_publish`，若只剩 1 个平台（如 `youtube`）则按冰爪规范用 `publish_video`！
3. **多条视频串行发射**：严禁并发同时打多个 `batch_publish` 互相争抢 Safari 队列，坚持**一条视频发完再发下一条**。

---

## 三、超时、失败与异常恢复铁律

1. **绝不盲目重投**：一旦遇到 MCP 超时或结果不明，**严禁直接再次调用 `batch_publish`**！
2. **先只读核验原项目**：调用 `get_project(projectId)`（只读），精确检查 `project.publish_results` 中每个平台的真实 `status`：
   - `published`：**已成功！绝对不要再放进重试平台列表**，严禁对已成功平台开 `force: true`！
   - `failed`（且原因明确如“已取消：停在最终提交前”或用户已修复对应故障）：**仅将明确失败的平台**放入新子批重试，且必须继续复用原 `projectPath`，绝不用 `projectPath: "new"` 另建项目！
   - 账号级阻止（例如「今日头条账号资料未完善，暂不允许发布视频」）：直接停止后续视频的该平台投递，并在最终汇报中告知用户去后台完善资料。
   - 用户关闭的平台（返回 `skipped`：「已在设置 → 发布中关闭」）：如实记录，后续视频不再重复尝试。
3. **严禁越界操作**：绝不手改 `iceonix.json`，绝不用终端/脚本操作或重启 Safari、微信或冰爪 App。
4. **首评状态如实回报**：最终汇报照录冰爪状态（如 `waiting` 等待过审与电脑空闲后自动发 / `posted` 已发 / `needs_review` 需人工核对且绝不重发）。

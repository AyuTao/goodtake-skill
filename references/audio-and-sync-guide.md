# 人声、音画节奏双模式、毫秒级精准字幕与院线交响配乐指南

好视频一半靠声音。本手册覆盖**双模式音画节奏协同架构（代码原创同步设计 vs 用户指定音乐先行分析起伏）**、零杂音人声合成、杜绝漂移的 5ms 波形 VAD 字幕校准，以及代码直出院线级交响配乐与好莱坞 Sound Design 的全部工程细节。

---

## 零、音画节奏协同双模式架构（先分析起伏，还是同步设计？）

顶级电影科普绝不是“拍完画面再随便贴首 BGM”，而是根据是否有用户指定音乐，精准切换以下两种工业级音画协同流水线：

| 协同模式 | 适用场景 | 节拍主导方 | 具体工作流 |
|---|---|---|---|
| **模式 A：同步设计 · 代码原创交响（默认推荐）** | 用户未指定特定外部歌曲，希望配乐严丝合缝贴合讲述情绪 | **内容情绪 + 统一节拍网格双向协同** | 1. 确立统一 BPM（如 `96 BPM`）与剧本情绪曲线；<br>2. 旁白装配、分镜切换、**关键程序动画触发点与核心大标题砸屏点**全部写入共享锚点 `timeline.json` + `shots.json` + `syncCues`；<br>3. 代码作曲引擎读取这些锚点，专门在每个大标题砸屏与关键动画揭晓的精确毫秒点写下 **Riser + 200ms 窒息 Drop + 42Hz BOOM + 铜管/弦乐推潮**；<br>4. 反向导出 30fps `cinema_beats.json` 驱动视觉粒子呼吸与镜头微震。 |
| **模式 B：音乐先行 · 指定音频节奏驱动** | 用户指定了某首 BGM（`.mp3 / .wav / .m4a` 等），想围绕这首曲子的情绪起伏剪出高级卡点大片 | **指定音乐的 BPM、鼓点与能量起伏主导** | 1. **在写分镜与关键动画之前**，先调用冰爪 `analyze_music` 和/或运行 `scripts/analyze_music_rhythm.mjs <music>`；<br>2. 生成《导演节奏地图》与 30fps `cinema_beats.json`（含 `bpm`、`beats[]`、情绪爆点 `drops[]` 与段落 `sections[]`：`calm / build / climax / release`）；<br>3. 按音乐起伏反推排布内容：`calm` 段放密集讲解与温和推演，`build` 段加快切镜和数据爬坡，**`drops[]` 与 `climax` 强拍精确卡死核心大标题砸屏与关键动画核心揭晓**；<br>4. 用 FFmpeg 动态侧链把指定音乐与人声丝滑融合，同时保留无旁白高潮段的澎湃冲击！ |

### 模式 B（用户指定音乐）人声自动侧链融合配方
当使用用户指定音乐作为 `bgm_input`、冻结人声作为 `vo_master.wav` 时，用一条 FFmpeg 滤镜即可做出广播级自动避让母带 `score_master.wav`（不改动人声母带，只输出与人声丝滑避让后的音乐轨道）：
```bash
ffmpeg -y -i bgm_input.mp3 -i vo_master.wav \
  -filter_complex "[0:a]aresample=48000,volume=-5dB[bgm];[1:a]aresample=48000[vo];[bgm][vo]sidechaincompress=threshold=0.025:ratio=4.5:attack=15:release=220:makeup=1[ducked]" \
  -map "[ducked]" -t <TOTAL_DURATION_SEC> -c:a pcm_s16le assets/audio/score_master.wav
```
- 人声开口时音乐自动在 `15ms` 内柔和退让，人声停顿或进入 `drops[]` 大标题撞击空隙时在 `220ms` 内丝滑推回满能量！

---

## 一、纯净温润人声母带规范

### 1. 克隆人声“气口杂音”根治法
使用本地声音克隆（如 VoxCPM2）时，最常见的隐蔽灾难是**每 70–90 字内部切分段开头吐出一个 100ms 左右的“咦/呃”残音**。
- **根因**：参考音频末尾切在了开口元音拖尾（如 `i / a / e / u`）上，模型把该拖尾当成声纹底噪复制到每一段起音处。
- **铁律**：参考音频必须满足：
  1. 时长 `4–6 秒`，单句完整、语气平缓温润；
  2. **结尾必须是完整闭口收音 + 150ms 以上纯净静音尾**（如“……静静等待。”）；
  3. 严禁使用 `rubberband` / `atempo` 对成片配音强行加速，**全程保持 1.0x 原速**；
  4. 合成完毕后，必须**亲耳抽听首、中、尾至少 3 篇原始 WAV** 确认零杂音后才进入母带装配。

### 2. 96 BPM 整小节母带装配
运行 `scripts/assemble_vo_timeline.mjs`，对每幕人声施加：
- `aresample=48000`（统一 48kHz Stereo）
- `highpass=f=70`（干净滤除 70Hz 以下空调/低频轰鸣）
- `acompressor=threshold=-20dB:ratio=2.0:attack=10:release=140:makeup=2.0`（温和播客温暖动态）
- 每幕起点严格落在 **96.0 BPM（每拍 `0.625s`，每小节 `2.500s`）整数小节第 1 拍**，片尾预留 `5–6 秒` 给孤独钢琴余韵与终章定格。
- **重要纪律**：`vo_master.wav` 一旦生成即冻结为**最终母带，一字节不再修改**。

---

## 二、杜绝字幕错位：分段强制对齐 + 5ms PCM 波形 VAD 夹紧

### 为什么直接对整条长音频跑强制对齐一定会翻车？
1. **窗口截断**：Qwen3 Forced Aligner 单次处理超过 ~1000 字时会在尾部静默截断丢字；
2. **吞噬停顿导致提前闪出**：当音频中存在 0.5–3.0 秒停顿时，Forced Aligner 会把下一句第一个字的 `start` 向前拉长吞掉整段静音，导致字幕比人声**提前 0.3–1.4 秒**亮出来！

### 院线级零误差解决方案（已封装于 `scripts/calibrate_subtitles_vad.mjs`）
1. **分幕独立对齐**：分别对每一幕独立的 `p01.wav ~ p0N.wav` 运行 `transcribe_video(engine="qwen3", includeWords=true, referenceText=part.text)`，确保每段字数在 80–250 字内，达成 **100% 逐字零截断匹配**。
2. **精确偏移还原**：每字绝对时间 = `part.voStart + word.localTime`（与 FFmpeg `adelay` 毫秒偏移 100% 等价）。
3. **5ms 真实波形 VAD 包络夹紧**：
   - 直接解析原始 16-bit PCM WAV 采样，以 `15ms` 窗宽、`5ms` 步进计算 RMS 分贝包络 `envDb[]`；
   - **起音夹紧（`tightenStart`）**：若对齐起点处于静音区（`< -40 dBFS`），向后扫描至真正发声点并回退 `20ms`（保全 `s/sh/f/t/q` 清辅音）；若已处于发声区，向前最多回找 `35ms` 至静音边缘；
   - **落音夹紧（`tightenEnd`）**：从对齐终点逆向找到最后发声点（`> -42 dBFS`），仅加 `35ms` 自然收音尾韵；
4. **零重叠与最小可读保护**：
   - 绝不跨越 `> 0.22s` 停顿强行合并句子；
   - 相邻字幕强制保持 `≥ 30ms` 呼吸间隔；
   - 极短语气词（如 0.16s 的“记住”“只是”）在后方有充裕静音时补足至 `0.42s`，绝不侵占下一句；
   - 字幕渲染淡入淡出锁定 **`35ms`**，去掉句末多余逗号/句号（保留问号/感叹号/冒号），口语数字优雅映射为出版书面体（`2026 年 11 月 20 日`、`1/2`、`12 = 2×2×3`）。

---

## 三、院线级代码交响配乐 + 好莱坞 Sound Design（Swift + CoreAudio）

彻底告别“单薄正弦波”与“廉价电子琴 GM MIDI 感”，采用 **CoreAudio 真乐团 + Swift DSP 院线音效 + 实时人声侧链**三层母带架构（见 `scripts/compose_cinema_score.swift`）：

### 1. CoreAudio 关键工程避坑
- **绝对不要把多个 `AVAudioUnitSampler` 重复直连到同一个 `AVAudioUnitReverb`**！`AVAudioUnitReverb` 是单输入节点，后一次 `connect` 会静默覆盖前一次，导致只剩最后一个乐器发声！
- **正确拓扑**：
  `9 × AVAudioUnitSampler` → **多输入 `AVAudioMixerNode`** → **`AVAudioUnitEQ`（+2.5dB @ 85Hz 暖底，-2.2dB @ 1.4kHz 为人声挖出清晰甜点槽，+1.5dB @ 9kHz 空气感）** → **`AVAudioUnitReverb`（`.cathedral`, `wetDryMix: 32`）** → `mainMixerNode`（离线手动渲染 48kHz Float32 Stereo）。

### 2. 九轨交响编曲情绪曲线（D 小调 Hans Zimmer 风格）
- **核心和声进行**：`Dm9 → Bbmaj7 → Fmaj9 → C6/9`（沉思神秘）、`Dm9 → Am7 → Bbmaj7 → Asus4 → A7`（悬疑攀升）、`EbMaj7`（突变惊悚/失控风暴）、尾声回归孤独 `Dm9` 钢琴泛音；
- **乐器编制**：
  - `Grand Piano (0)`：贯穿全片的 8 分音符流动分解琶音（配微小人性化时差）+ 抒情主题动机；
  - `Cello (42)` + `Slow Strings (49)`：厚重低音根基与宽广弦乐群；
  - `French Horns (60)` + `Church Pipe Organ (19)`：仅在史诗高潮与神圣揭示处庄严轰鸣；
  - `Harp (46)` + `Celesta (8)`：晶莹星尘织体；
  - `Pizzicato (45)` + `Timpani (47)`：紧扣 96 BPM 的精密机械推进脉冲。

### 3. 好莱坞 Sound Design 与 200ms 窒息 Drop
直接读取 `shots.json` 每一镜的毫秒切点与 `syncCues` 自动生成：
- **42Hz 次低音重锤 BOOM**：正弦频滑 `105Hz → 34Hz` + 温暖 `tanh` 磁带饱和 + 低通空气爆破尾音；
- **空气感吸气 Riser**：`1.75–2.20s` 扫频噪声 + 柔和五度上扬泛音（控制纯音比例 ≤ 25%，避免廉价合成器感）；
- **200ms 窒息静默 Drop**：在全片最炸裂的高潮 BOOM 前刻意抽空交响乐团 `88%` 音量持续 `200ms`，制造极致声压反差；
- **清脆胶片快门（Shutter）**：`35ms` 高通瞬态 + `1650Hz` 微弱金属谐振，精准卡在每个硬切点；
- **音画交互音效**：念诵序列时触发上行音阶晶莹钟琴（`addHarmonicPing`），划除/切换动作触发立体声空气划切（`addWhooshSlice`）。

### 4. 人声包络平滑侧链与 30fps 联动数据
- 读取 `vo_master.wav` 包络（`attack ~10ms`, `release ~120ms`）：人声活跃时交响平滑避让至 `0.36×`（人声永远丝绒般浮在前景），停顿与转场瞬间华丽推起；音效仅微退至 `0.80×` 保持影院冲击。
- 同步导出 30fps 的 `cinema_beats.json`（每帧 `frameEnergies[]` 与 `impactShake[]`），驱动视觉引擎的微粒呼吸与低音镜头微震！

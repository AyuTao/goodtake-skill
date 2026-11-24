#!/usr/bin/env node
/**
 * GoodTake V2.2 — 用户指定音乐节奏、鼓点与能量起伏分析器
 *
 * 零外部 npm 依赖，仅依赖系统 ffmpeg / ffprobe。
 * 当用户指定了一首背景音乐（mp3 / wav / m4a / flac 等）时，在写分镜与关键动画之前先运行本脚本：
 *   1. 自动估算主节奏 BPM 与全曲节拍网格 beats[]
 *   2. 检测低频底鼓/重音瞬态与情绪爆点 drops[]（最适合卡大标题砸屏与关键动画触发点！）
 *   3. 自动划分全曲情绪起伏段落 sections[]（calm / build / climax / release）
 *   4. 输出与渲染引擎 100% 兼容的 30fps cinema_beats.json（含 frameEnergies / bassEnergies / impactShake）
 *
 * 用法：
 *   node analyze_music_rhythm.mjs <audio_path> [output_json_path] [--fps 30]
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Usage: node analyze_music_rhythm.mjs <audio_path> [output_json_path] [--fps 30]");
  process.exit(1);
}

let audioPath = "";
let outputPath = "";
let fps = 30;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--fps" && args[i + 1]) {
    fps = Number(args[++i]) || 30;
  } else if (!audioPath) {
    audioPath = path.resolve(args[i]);
  } else if (!outputPath) {
    outputPath = path.resolve(args[i]);
  }
}

if (!fs.existsSync(audioPath)) {
  console.error(`Error: Audio file not found: ${audioPath}`);
  process.exit(1);
}

if (!outputPath) {
  outputPath = path.join(path.dirname(audioPath), "cinema_beats.json");
}

const SAMPLE_RATE = 22050;
const HOP_SEC = 0.01; // 10ms 高精度瞬态分析步长
const HOP_SAMPLES = Math.round(SAMPLE_RATE * HOP_SEC);

function decodeMonoPcm(file, afFilter = null) {
  const ffArgs = ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SAMPLE_RATE)];
  if (afFilter) ffArgs.push("-af", afFilter);
  ffArgs.push("-f", "s16le", "pipe:1");
  const buf = execFileSync("ffmpeg", ffArgs, { maxBuffer: 256 * 1024 * 1024 });
  const sampleCount = Math.floor(buf.length / 2);
  const floats = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    floats[i] = buf.readInt16LE(i * 2) / 32768.0;
  }
  return floats;
}

const fullPcm = decodeMonoPcm(audioPath);
const bassPcm = decodeMonoPcm(audioPath, "lowpass=f=180");
const durationSec = Number((fullPcm.length / SAMPLE_RATE).toFixed(3));
const numHops = Math.floor(fullPcm.length / HOP_SAMPLES);

// 1. 计算 10ms 步长的全频 RMS 与低频 RMS
const fullRms = new Float32Array(numHops);
const bassRms = new Float32Array(numHops);
for (let h = 0; h < numHops; h++) {
  const start = h * HOP_SAMPLES;
  const end = Math.min(start + HOP_SAMPLES * 2, fullPcm.length);
  let sf = 0;
  let sb = 0;
  for (let i = start; i < end; i++) {
    const vf = fullPcm[i];
    const vb = bassPcm[i];
    sf += vf * vf;
    sb += vb * vb;
  }
  const n = Math.max(1, end - start);
  fullRms[h] = Math.sqrt(sf / n);
  bassRms[h] = Math.sqrt(sb / n);
}

function percentile(arr, p) {
  const sorted = Array.from(arr).sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 1e-6;
}

const fullNormBase = Math.max(percentile(fullRms, 0.96), 1e-5);
const bassNormBase = Math.max(percentile(bassRms, 0.96), 1e-5);

// 2. 计算加权瞬态包络（Onset Flux：低频权重 0.65 + 全频权重 0.35）
const onsetFlux = new Float32Array(numHops);
for (let h = 1; h < numHops; h++) {
  const df = Math.max(0, fullRms[h] / fullNormBase - fullRms[h - 1] / fullNormBase);
  const db = Math.max(0, bassRms[h] / bassNormBase - bassRms[h - 1] / bassNormBase);
  onsetFlux[h] = db * 0.65 + df * 0.35;
}

// 3. 自相关估算 BPM（主搜索范围 75~155 BPM）
const minLag = Math.round((60 / 155) / HOP_SEC);
const maxLag = Math.round((60 / 75) / HOP_SEC);
let bestLag = Math.round((60 / 100) / HOP_SEC);
let bestScore = -1;

for (let lag = minLag; lag <= maxLag; lag++) {
  let corr = 0;
  const limit = numHops - lag;
  for (let h = 0; h < limit; h++) {
    corr += onsetFlux[h] * onsetFlux[h + lag];
  }
  // 轻微偏好影视常用甜点节拍 88~128 BPM（高斯权重）
  const candBpm = 60 / (lag * HOP_SEC);
  const prior = 1 + 0.12 * Math.exp(-Math.pow((candBpm - 108) / 26, 2));
  const score = (corr / Math.max(1, limit)) * prior;
  if (score > bestScore) {
    bestScore = score;
    bestLag = lag;
  }
}

const bpm = Number((60 / (bestLag * HOP_SEC)).toFixed(1));
const beatIntervalSec = Number((60 / bpm).toFixed(4));

// 4. 寻找最佳首拍相位并生成全曲节拍网格 beats[]
let bestPhase = 0;
let bestPhaseScore = -1;
for (let phase = 0; phase < bestLag; phase++) {
  let s = 0;
  for (let h = phase; h < numHops; h += bestLag) {
    s += onsetFlux[h];
  }
  if (s > bestPhaseScore) {
    bestPhaseScore = s;
    bestPhase = phase;
  }
}

const beats = [];
for (let t = bestPhase * HOP_SEC; t < durationSec; t += beatIntervalSec) {
  beats.push(Number(t.toFixed(3)));
}

// 5. 检测强鼓点与情绪爆点 drops[]（局部峰值 + 前后能量跃迁过滤）
const fluxP85 = percentile(onsetFlux, 0.85);
const fluxThreshold = Math.max(fluxP85 * 1.45, 0.08);
const minGapHops = Math.round(0.42 / HOP_SEC);
const rawPeaks = [];

for (let h = 3; h < numHops - 3; h++) {
  const v = onsetFlux[h];
  if (v < fluxThreshold) continue;
  if (
    v >= onsetFlux[h - 1] &&
    v >= onsetFlux[h - 2] &&
    v >= onsetFlux[h + 1] &&
    v >= onsetFlux[h + 2]
  ) {
    if (!rawPeaks.length || h - rawPeaks[rawPeaks.length - 1].h >= minGapHops) {
      rawPeaks.push({ h, strength: v });
    } else if (v > rawPeaks[rawPeaks.length - 1].strength) {
      rawPeaks[rawPeaks.length - 1] = { h, strength: v };
    }
  }
}

// 筛选最具戏剧性的 Drop / 视觉卡点（前 1.2s 平均能量明显低于后 1.2s，或本身瞬态极强）
const drops = [];
const winHops = Math.round(1.2 / HOP_SEC);
for (const p of rawPeaks) {
  let preSum = 0;
  let preCnt = 0;
  for (let i = Math.max(0, p.h - winHops); i < p.h; i++) {
    preSum += fullRms[i] / fullNormBase;
    preCnt++;
  }
  let postSum = 0;
  let postCnt = 0;
  for (let i = p.h; i < Math.min(numHops, p.h + winHops); i++) {
    postSum += fullRms[i] / fullNormBase;
    postCnt++;
  }
  const preAvg = preSum / Math.max(1, preCnt);
  const postAvg = postSum / Math.max(1, postCnt);
  const contrast = postAvg - preAvg;
  const score = p.strength + Math.max(0, contrast) * 1.2;
  if (score >= fluxThreshold * 1.15 || contrast >= 0.16) {
    drops.push({
      time: Number((p.h * HOP_SEC).toFixed(3)),
      strength: Number(Math.min(1, p.strength / Math.max(fluxThreshold * 2.5, 0.25)).toFixed(3)),
      energyJump: Number(contrast.toFixed(3)),
      role: contrast >= 0.18 ? "drop_climax" : "strong_beat",
    });
  }
}

// 6. 以 2 秒块划分情绪起伏段落 sections[]（calm / build / climax / release）
const BLOCK_SEC = 2.0;
const numBlocks = Math.max(1, Math.ceil(durationSec / BLOCK_SEC));
const blockEnergy = [];
for (let b = 0; b < numBlocks; b++) {
  const sH = Math.floor((b * BLOCK_SEC) / HOP_SEC);
  const eH = Math.min(numHops, Math.floor(((b + 1) * BLOCK_SEC) / HOP_SEC));
  let sum = 0;
  for (let h = sH; h < eH; h++) sum += fullRms[h] / fullNormBase;
  blockEnergy.push(sum / Math.max(1, eH - sH));
}

const medE = percentile(blockEnergy, 0.5);
const highE = percentile(blockEnergy, 0.78);
const lowE = percentile(blockEnergy, 0.25);

const blockLabels = blockEnergy.map((e, i) => {
  const prev = i > 0 ? blockEnergy[i - 1] : e;
  const next = i < blockEnergy.length - 1 ? blockEnergy[i + 1] : e;
  if (e >= highE) return "climax";
  if (e <= lowE) return i === 0 ? "intro_calm" : i === blockEnergy.length - 1 ? "outro_release" : "calm";
  if (next - prev > 0.12 && e >= medE * 0.75) return "build";
  if (prev - next > 0.14) return "release";
  return e >= medE ? "drive" : "calm";
});

const sections = [];
for (let b = 0; b < numBlocks; b++) {
  const start = Number((b * BLOCK_SEC).toFixed(2));
  const end = Number(Math.min(durationSec, (b + 1) * BLOCK_SEC).toFixed(2));
  const label = blockLabels[b];
  const avgEnergy = Number(Math.min(1, blockEnergy[b]).toFixed(3));
  if (sections.length && sections[sections.length - 1].mood === label) {
    const last = sections[sections.length - 1];
    last.end = end;
    last.avgEnergy = Number(((last.avgEnergy + avgEnergy) / 2).toFixed(3));
  } else {
    const suggestionMap = {
      intro_calm: "静默/钩子铺垫，建立悬念氛围",
      calm: "深入浅出讲解、温和程序动画推演",
      build: "加快分镜切频、数据/曲线爬坡蓄力",
      drive: "核心论点推进、真实界面或动画快切",
      climax: "核心大标题砸屏、高潮视觉奇观或关键揭示！",
      release: "情绪回落、金句沉淀留白",
      outro_release: "尾声升华、极简定格收束",
    };
    sections.push({
      start,
      end,
      mood: label,
      avgEnergy,
      directorHint: suggestionMap[label] || "常规节奏推进",
    });
  }
}

// 7. 生成 30fps 视觉驱动曲线（与 compose_cinema_score.swift 输出结构完全兼容！）
const totalFrames = Math.ceil(durationSec * fps);
const frameEnergies = new Array(totalFrames);
const bassEnergies = new Array(totalFrames);
const impactShake = new Array(totalFrames).fill(0);

for (let f = 0; f < totalFrames; f++) {
  const t = f / fps;
  const h = Math.min(numHops - 1, Math.max(0, Math.round(t / HOP_SEC)));
  frameEnergies[f] = Number(Math.min(1, fullRms[h] / fullNormBase).toFixed(3));
  bassEnergies[f] = Number(Math.min(1, bassRms[h] / bassNormBase).toFixed(3));
}

// 在每个 Drop / 重拍后注入 0.25s 衰减镜头微震脉冲
for (const d of drops) {
  const startF = Math.round(d.time * fps);
  const decayFrames = Math.round(0.26 * fps);
  const amp = d.role === "drop_climax" ? Math.min(1, 0.55 + d.strength * 0.45) : d.strength * 0.45;
  for (let k = 0; k < decayFrames && startF + k < totalFrames; k++) {
    const env = amp * Math.exp((-4.5 * k) / Math.max(1, decayFrames));
    impactShake[startF + k] = Number(Math.max(impactShake[startF + k], env).toFixed(3));
  }
}

const result = {
  source: path.basename(audioPath),
  mode: "user_music_analyzed",
  durationSec,
  fps,
  bpm,
  beatIntervalSec,
  beatCount: beats.length,
  beats,
  drops,
  sections,
  frameEnergies,
  bassEnergies,
  impactShake,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");

console.log(`Music rhythm analysis complete -> ${outputPath}`);
console.log(`  Duration: ${durationSec}s | Estimated BPM: ${bpm} | Beats: ${beats.length} | Key Drops/Peaks: ${drops.length}`);
console.log("\n=== Director Rhythm Map (情绪起伏与建议落点) ===");
for (const s of sections) {
  console.log(`  [${s.start.toFixed(1)}s - ${s.end.toFixed(1)}s] ${s.mood.padEnd(13)} energy=${s.avgEnergy.toFixed(2)}  -> ${s.directorHint}`);
}
const topDrops = [...drops].sort((a, b) => b.energyJump + b.strength - (a.energyJump + a.strength)).slice(0, 10);
if (topDrops.length) {
  console.log("\n=== Top Title / Key-Animation Sync Points (最炸卡点建议) ===");
  for (const d of topDrops.sort((a, b) => a.time - b.time)) {
    console.log(`  @ ${d.time.toFixed(3)}s  [${d.role}]  strength=${d.strength}  jump=${d.energyJump}`);
  }
}

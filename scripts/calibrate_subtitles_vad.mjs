#!/usr/bin/env node
/**
 * GoodTake — 分段强制对齐合并 + 5ms PCM 真实波形 VAD 零误差字幕校准器
 *
 * 彻底根治强制对齐模型的两大痛点：
 *   1) 长音频 >1000 字尾部截断（改用分幕独立对齐 p01..p0N）
 *   2) 段间静音被吞噬导致字幕提前 0.3–1.4s 闪出（使用原始 WAV 5ms RMS 包络精准夹紧首尾）
 *
 * 用法：
 *   node calibrate_subtitles_vad.mjs --project <项目目录> [--align-dir <对齐JSON目录>]
 *
 * 输入要求：
 *   - <project>/assets/audio/timeline.json
 *   - <project>/assets/audio/p01.wav ... p0N.wav
 *   - <align-dir>/align_<partId>.json（每幕独立强制对齐输出，含 data.words 或 words）
 *   - 可选：<project>/assets/audio/display_map.json（口语读音句 -> 规范出版显示文本映射）
 *
 * 输出：
 *   - <project>/assets/audio/align_vad.json（逐字绝对时间戳 + VAD 校准分句）
 *   - <project>/assets/audio/subtitles.json（零重叠、零提前、零拖尾最终字幕数组）
 */
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { project: process.cwd(), alignDir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === "--align-dir" && argv[i + 1]) args.alignDir = argv[++i];
  }
  return args;
}

function readWavEnv(wavPath) {
  const buf = fs.readFileSync(wavPath);
  let pos = 12;
  let sampleRate = 48000, numChannels = 1, bitsPerSample = 16;
  let dataStart = 44, dataLen = buf.length - 44;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const sz = buf.readUInt32LE(pos + 4);
    if (id === "fmt ") {
      numChannels = buf.readUInt16LE(pos + 10);
      sampleRate = buf.readUInt32LE(pos + 12);
      bitsPerSample = buf.readUInt16LE(pos + 22);
    } else if (id === "data") {
      dataStart = pos + 8;
      dataLen = sz;
      break;
    }
    pos += 8 + sz + (sz % 2);
  }
  const bytesPerSample = bitsPerSample / 8;
  const totalFrames = Math.floor(dataLen / (bytesPerSample * numChannels));
  const stepSec = 0.005; // 5ms 精细步进
  const winFrames = Math.max(1, Math.round(sampleRate * 0.015));
  const stepFrames = Math.max(1, Math.round(sampleRate * stepSec));
  const envDb = [];
  for (let f = 0; f < totalFrames; f += stepFrames) {
    let sumSq = 0, cnt = 0;
    const end = Math.min(totalFrames, f + winFrames);
    for (let i = f; i < end; i++) {
      const off = dataStart + i * numChannels * bytesPerSample;
      if (off + 2 > buf.length) break;
      const v = buf.readInt16LE(off) / 32768;
      sumSq += v * v;
      cnt++;
    }
    const rms = cnt ? Math.sqrt(sumSq / cnt) : 0;
    envDb.push(rms > 1e-6 ? 20 * Math.log10(rms) : -120);
  }
  return { envDb, stepSec, duration: totalFrames / sampleRate };
}

function tightenStart(env, localStart, localEnd, threshDb = -40) {
  const i0 = Math.max(0, Math.floor(localStart / env.stepSec));
  const i1 = Math.min(env.envDb.length - 1, Math.ceil(localEnd / env.stepSec));
  if (env.envDb[i0] > threshDb) {
    let k = i0;
    const minK = Math.max(0, i0 - 7); // 最多回溯 35ms 保全清辅音起音
    while (k > minK && env.envDb[k - 1] > threshDb - 4) k--;
    return Math.max(0, k * env.stepSec);
  }
  for (let i = i0; i <= i1; i++) {
    if (env.envDb[i] > threshDb) {
      return Math.max(localStart, i * env.stepSec - 0.02);
    }
  }
  return localStart;
}

function tightenEnd(env, localStart, localEnd, threshDb = -42) {
  const i0 = Math.max(0, Math.floor(localStart / env.stepSec));
  const i1 = Math.min(env.envDb.length - 1, Math.ceil(localEnd / env.stepSec));
  for (let i = i1; i >= i0; i--) {
    if (env.envDb[i] > threshDb) {
      return Math.min(localEnd, i * env.stepSec + 0.035);
    }
  }
  return localEnd;
}

function main() {
  const opts = parseArgs(process.argv);
  const root = path.resolve(opts.project);
  const audioDir = path.join(root, "assets/audio");
  const alignDir = opts.alignDir ? path.resolve(opts.alignDir) : path.join(audioDir, "align");

  const tl = JSON.parse(fs.readFileSync(path.join(audioDir, "timeline.json"), "utf-8"));
  const displayMapPath = path.join(audioDir, "display_map.json");
  const displayMap = fs.existsSync(displayMapPath) ? JSON.parse(fs.readFileSync(displayMapPath, "utf-8")) : {};

  const allChars = [];
  const allClauses = [];

  for (const part of tl.parts) {
    const alignPath = path.join(alignDir, `align_${part.id}.json`);
    if (!fs.existsSync(alignPath)) throw new Error(`Missing alignment file: ${alignPath}`);
    const raw = JSON.parse(fs.readFileSync(alignPath, "utf-8"));
    const data = raw.data || raw;
    const words = data.words || [];
    const env = readWavEnv(path.join(audioDir, `${part.id}.wav`));

    const cleanRef = part.text.replace(/[，。？！：；、—…\s]/g, "");
    const cleanWords = words.map((w) => (w.text || w.word || "").replace(/[，。？！：；、—…\s]/g, "")).join("");
    console.log(`${part.id}: ref=${cleanRef.length} aligned=${cleanWords.length} match=${cleanRef === cleanWords ? "PERFECT" : "DIFF"}`);

    const charTimes = [];
    for (const w of words) {
      const pure = (w.text || w.word || "").replace(/[，。？！：；、—…\s]/g, "");
      if (!pure.length) continue;
      const ws = w.start ?? w.startSec ?? 0;
      const we = w.end ?? w.endSec ?? ws;
      const step = (we - ws) / pure.length;
      for (let k = 0; k < pure.length; k++) {
        const ls = ws + k * step;
        const le = ws + (k + 1) * step;
        charTimes.push({
          partId: part.id,
          ch: pure[k],
          localStart: ls,
          localEnd: le,
          start: Number((part.voStart + ls).toFixed(4)),
          end: Number((part.voStart + le).toFixed(4)),
        });
      }
    }
    allChars.push(...charTimes);

    const clauses = part.text.match(/[^，。？！：；]+[，。？！：；]?/g) || [];
    let ci = 0;
    for (const cl of clauses) {
      const pure = cl.replace(/[，。？！：；、—…\s]/g, "");
      if (!pure.length) continue;
      const first = charTimes[ci];
      const last = charTimes[ci + pure.length - 1];
      ci += pure.length;
      if (!first || !last) continue;

      const vadStart = tightenStart(env, first.localStart, last.localEnd, -40);
      const vadEnd = tightenEnd(env, vadStart, last.localEnd, -42);

      allClauses.push({
        partId: part.id,
        text: cl,
        rawStart: first.start,
        rawEnd: last.end,
        start: Number((part.voStart + vadStart).toFixed(3)),
        end: Number((part.voStart + vadEnd).toFixed(3)),
      });
    }
  }

  // 生成最终零重叠电影字幕（去句末冗余逗号句号，保留问号/感叹号/冒号）
  const finalSubs = [];
  for (let i = 0; i < allClauses.length; i++) {
    const cl = allClauses[i];
    const next = allClauses[i + 1];
    const disp = (displayMap[cl.text] || cl.text).replace(/[，。；]$/, "");
    const cur = { partId: cl.partId, text: disp, start: cl.start, end: cl.end };

    if (finalSubs.length > 0) {
      const prev = finalSubs[finalSubs.length - 1];
      if (cur.start < prev.end + 0.03) {
        const mid = (prev.end + cur.start) / 2;
        prev.end = Number((mid - 0.015).toFixed(3));
        cur.start = Number((mid + 0.015).toFixed(3));
      }
    }

    let desiredEnd = cur.end + 0.04;
    if (desiredEnd - cur.start < 0.42) desiredEnd = cur.start + 0.42;
    if (next) desiredEnd = Math.min(desiredEnd, next.start - 0.04);

    cur.start = Number(cur.start.toFixed(3));
    cur.end = Number(Math.max(cur.start + 0.20, desiredEnd).toFixed(3));
    finalSubs.push(cur);
  }

  for (let i = 1; i < finalSubs.length; i++) {
    if (finalSubs[i].start < finalSubs[i - 1].end) {
      throw new Error(`Subtitle overlap at index ${i}`);
    }
  }

  fs.writeFileSync(path.join(audioDir, "align_vad.json"), JSON.stringify({ chars: allChars, clauses: allClauses }, null, 2));
  fs.writeFileSync(path.join(audioDir, "subtitles.json"), JSON.stringify(finalSubs, null, 2));
  console.log(`DONE! Wrote ${finalSubs.length} VAD-calibrated zero-overlap subtitles to assets/audio/subtitles.json`);
}

main();

#!/usr/bin/env node
/**
 * GoodTake — 通用 BPM 整小节对齐人声母带装配脚本
 *
 * 用法：
 *   node assemble_vo_timeline.mjs --project <项目目录> [--bpm 96] [--fps 30]
 *
 * 输入要求：
 *   <project>/assets/audio/parts_config.json
 *     格式：[{ "id": "p01", "preBeats": 2, "minTailSec": 1.0, "text": "朗读口播原稿..." }, ...]
 *   <project>/assets/audio/p01.wav ... p0N.wav（1.0x 原速纯净干声）
 *
 * 输出：
 *   <project>/assets/audio/vo_master.wav   （48kHz Stereo PCM16，冻结母带，一字节不再改动）
 *   <project>/assets/audio/timeline.json   （精确小节起止时间、voStart/voEnd 与完整原稿）
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = { project: process.cwd(), bpm: 96.0, fps: 30, width: 1920, height: 1080 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--project" && argv[i + 1]) args.project = argv[++i];
    else if (argv[i] === "--bpm" && argv[i + 1]) args.bpm = parseFloat(argv[++i]);
    else if (argv[i] === "--fps" && argv[i + 1]) args.fps = parseInt(argv[++i], 10);
    else if (argv[i] === "--width" && argv[i + 1]) args.width = parseInt(argv[++i], 10);
    else if (argv[i] === "--height" && argv[i + 1]) args.height = parseInt(argv[++i], 10);
  }
  return args;
}

function probeDuration(wavPath) {
  return parseFloat(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", wavPath],
      { encoding: "utf-8" }
    ).trim()
  );
}

function main() {
  const opts = parseArgs(process.argv);
  const root = path.resolve(opts.project);
  const audioDir = path.join(root, "assets/audio");
  const configPath = path.join(audioDir, "parts_config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Missing parts config: ${configPath}`);
  }

  const parts = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const BEAT_SEC = 60.0 / opts.bpm;
  const BAR_SEC = 4.0 * BEAT_SEC;

  const partsMeta = [];
  let cursorBars = 0;
  const filterParts = [];
  const inputs = [];

  parts.forEach((pItem, idx) => {
    const wavPath = path.join(audioDir, `${pItem.id}.wav`);
    if (!fs.existsSync(wavPath)) throw new Error(`Missing audio part: ${wavPath}`);
    const rawDur = probeDuration(wavPath);
    const preBeats = pItem.preBeats ?? (idx === 0 ? 2 : 1);
    const minTailSec = pItem.minTailSec ?? (idx === parts.length - 1 ? 5.5 : 1.0);
    const preSec = preBeats * BEAT_SEC;

    let bars = Math.ceil((preSec + rawDur + minTailSec) / BAR_SEC);
    if (idx === parts.length - 1 && bars * BAR_SEC - (preSec + rawDur) < 5.0) bars += 1;

    const start = Number((cursorBars * BAR_SEC).toFixed(4));
    const duration = Number((bars * BAR_SEC).toFixed(4));
    const voStart = Number((start + preSec).toFixed(4));
    const voEnd = Number((voStart + rawDur).toFixed(4));

    partsMeta.push({
      id: pItem.id,
      startBar: cursorBars,
      bars,
      start,
      duration,
      voStart,
      voEnd,
      rawVoDuration: Number(rawDur.toFixed(3)),
      text: pItem.text,
    });

    cursorBars += bars;
    inputs.push("-i", wavPath);
    const delayMs = Math.round(voStart * 1000);
    // 温和 70Hz 干净低切 + 播客温暖动态平衡，绝不加速（严格 1.0x 原速）
    filterParts.push(
      `[${idx}:a]aresample=48000,highpass=f=70,acompressor=threshold=-20dB:ratio=2.0:attack=10:release=140:makeup=2.0,adelay=${delayMs}|${delayMs}[a${idx}]`
    );
  });

  const totalDurationSec = Number((cursorBars * BAR_SEC).toFixed(4));
  const mixInputs = parts.map((_, i) => `[a${i}]`).join("");
  const filterComplex = [
    ...filterParts,
    `anullsrc=r=48000:cl=stereo:d=${totalDurationSec}[bed]`,
    `[bed]${mixInputs}amix=inputs=${parts.length + 1}:duration=first:normalize=0,alimiter=limit=0.95[out]`,
  ].join(";");

  const voMasterPath = path.join(audioDir, "vo_master.wav");
  execFileSync(
    "ffmpeg",
    ["-y", "-hide_banner", "-loglevel", "warning", ...inputs, "-filter_complex", filterComplex, "-map", "[out]", "-c:a", "pcm_s16le", "-ar", "48000", "-ac", "2", voMasterPath],
    { stdio: "inherit" }
  );

  const meta = {
    bpm: opts.bpm,
    beatSec: BEAT_SEC,
    barSec: BAR_SEC,
    fps: opts.fps,
    width: opts.width,
    height: opts.height,
    totalBars: cursorBars,
    totalDurationSec,
    parts: partsMeta,
    fullReferenceText: parts.map((x) => x.text).join(""),
  };

  fs.writeFileSync(path.join(audioDir, "timeline.json"), JSON.stringify(meta, null, 2), "utf-8");

  console.log(`\n=== CINEMA ${opts.bpm}-BPM TIMELINE BUILT ===`);
  partsMeta.forEach((s) => {
    console.log(`${s.id} | bars ${s.startBar}..${s.startBar + s.bars} (${s.bars}b) | ${s.start.toFixed(2)}s -> ${(s.start + s.duration).toFixed(2)}s (voStart=${s.voStart.toFixed(3)}s, raw=${s.rawVoDuration.toFixed(2)}s)`);
  });
  console.log(`TOTAL: ${totalDurationSec.toFixed(2)}s (${(totalDurationSec / 60).toFixed(2)} min, ${cursorBars} bars @ ${opts.bpm} BPM)`);
}

main();

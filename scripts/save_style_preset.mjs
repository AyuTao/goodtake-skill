#!/usr/bin/env node
/**
 * GoodTake V2.3 — 视频风格资产库管理工具（列出 / 加载 / 沉淀保存为可复用风格）
 *
 * 零外部 npm 依赖，供阶段 0 风格挑选与阶段 8 完工沉淀使用。
 *
 * 用法：
 *   node save_style_preset.mjs --list [--dir <styles_dir>]
 *   node save_style_preset.mjs --get <style_id> [--dir <styles_dir>]
 *   node save_style_preset.mjs --save <input_style.json> [--id <slug>] [--dir <styles_dir>]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultStylesDir = path.resolve(__dirname, "..", "styles");

const args = process.argv.slice(2);
let mode = "";
let targetArg = "";
let customId = "";
let stylesDir = defaultStylesDir;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--list") mode = "list";
  else if (a === "--get") {
    mode = "get";
    targetArg = args[++i] || "";
  } else if (a === "--save") {
    mode = "save";
    targetArg = args[++i] || "";
  } else if (a === "--id") {
    customId = args[++i] || "";
  } else if (a === "--dir") {
    stylesDir = path.resolve(args[++i] || defaultStylesDir);
  }
}

if (!mode) {
  console.error("Usage:");
  console.error("  node save_style_preset.mjs --list [--dir <styles_dir>]");
  console.error("  node save_style_preset.mjs --get <style_id> [--dir <styles_dir>]");
  console.error("  node save_style_preset.mjs --save <input_style.json> [--id <slug>] [--dir <styles_dir>]");
  process.exit(1);
}

fs.mkdirSync(stylesDir, { recursive: true });

function loadAllStyles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const full = path.join(dir, f);
      const data = JSON.parse(fs.readFileSync(full, "utf8"));
      return { file: f, path: full, data };
    });
}

function slugify(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || `custom-style-${Date.now()}`;
}

if (mode === "list") {
  const items = loadAllStyles(stylesDir);
  if (!items.length) {
    console.log(`No style presets found in ${stylesDir}`);
    process.exit(0);
  }
  console.log(`Available GoodTake styles (${items.length}) in ${stylesDir}:\n`);
  for (const it of items) {
    const d = it.data;
    const bpm = d.audio?.bpm ? `${d.audio.bpm} BPM` : "auto BPM";
    const bg = d.palette?.background || "-";
    const ac = d.palette?.accentPrimary || "-";
    console.log(`  - [${d.id || path.parse(it.file).name}] ${d.name || it.file}`);
    console.log(`      ${d.tagline || ""}`);
    console.log(`      Palette: ${bg} / ${ac} | Audio: ${bpm} (${d.audio?.musicalKey || "custom"}) | File: ${it.file}`);
  }
} else if (mode === "get") {
  const items = loadAllStyles(stylesDir);
  const found = items.find(
    (it) =>
      it.data.id === targetArg ||
      path.parse(it.file).name === targetArg ||
      it.data.name === targetArg
  );
  if (!found) {
    console.error(`Style not found: ${targetArg}`);
    process.exit(1);
  }
  console.log(JSON.stringify(found.data, null, 2));
} else if (mode === "save") {
  if (!targetArg || !fs.existsSync(targetArg)) {
    console.error(`Input style JSON not found: ${targetArg}`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(path.resolve(targetArg), "utf8"));
  const id = slugify(customId || raw.id || raw.name);
  const preset = {
    id,
    name: raw.name || id,
    tagline: raw.tagline || "用户沉淀的自定义电影风格预设",
    bestFor: Array.isArray(raw.bestFor) ? raw.bestFor : ["通用科普与知识视频"],
    savedAt: new Date().toISOString().slice(0, 10),
    palette: raw.palette || {},
    typography: raw.typography || {},
    visualMix: raw.visualMix || {},
    pacing: raw.pacing || {},
    audio: raw.audio || {},
    cover: raw.cover || { safeCoreBox: { x: 585, y: 140, w: 750, h: 780 } },
  };
  const outFile = path.join(stylesDir, `${id}.json`);
  fs.writeFileSync(outFile, JSON.stringify(preset, null, 2) + "\n", "utf8");
  console.log(`Saved reusable GoodTake style preset -> ${outFile}`);
}

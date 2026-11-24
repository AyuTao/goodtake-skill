#!/usr/bin/env node
/**
 * GoodTake V2.1 — 全平台防裁切封面自动审计脚本
 *
 * 零外部 npm 依赖，仅依赖系统 ffmpeg / ffprobe。
 * 输入任意 16:9 封面图（推荐 1920x1080），自动生成高清审计图 cover_audit.jpg：
 *   - 上半区：16:9 原图叠加四层平台安全线：
 *       * 青色线 (Cyan)   : 1:1 方形信息流裁切边界   (1080x1080, x=420..1500)
 *       * 黄色线 (Yellow) : 6:7 竖版信息流裁切边界   (926x1080,  x=497..1423)
 *       * 白色线 (White)  : 3:4 最严竖版裁切边界     (810x1080,  x=555..1365)
 *       * 翠绿粗框 (Lime) : 全平台绝对核心安全区     (750x780,   x=585..1335, y=140..920)
 *                           —— 主标题文字与核心主体必须 100% 落在此绿框内！
 *       * 红色禁区 (Red)  : 16:9 与 3:4 右下角时长角标遮挡区
 *   - 下半区：4 格真实平台裁切模拟预览并排对照（16:9 / 1:1 / 6:7 / 3:4）
 *
 * 用法：
 *   node verify_cover_safezone.mjs <cover_image_path> [output_audit_jpg]
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const [, , inputPath, outputArg] = process.argv;
if (!inputPath) {
  console.error("Usage: node verify_cover_safezone.mjs <cover_image_path> [output_audit_jpg]");
  process.exit(1);
}

const resolvedInput = path.resolve(inputPath);
if (!fs.existsSync(resolvedInput)) {
  console.error(`Error: Input cover image not found: ${resolvedInput}`);
  process.exit(1);
}

const outputPath = path.resolve(
  outputArg || path.join(path.dirname(resolvedInput), `${path.parse(resolvedInput).name}_safezone_audit.jpg`)
);

function probeImage(file) {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file],
    { encoding: "utf8" }
  );
  const info = JSON.parse(out);
  const stream = info.streams?.[0];
  if (!stream?.width || !stream?.height) {
    throw new Error(`Could not probe image dimensions for ${file}`);
  }
  return { width: Number(stream.width), height: Number(stream.height) };
}

function hasDrawtextAndFont() {
  try {
    const filters = execFileSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
    if (!/\bdrawtext\b/.test(filters)) return null;
  } catch {
    return null;
  }
  const candidates = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
  ];
  for (const f of candidates) {
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function escFont(p) {
  return p.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

const { width, height } = probeImage(resolvedInput);
const ratio = width / height;
if (Math.abs(ratio - 16 / 9) > 0.03) {
  console.warn(
    `[WARN] Input cover is ${width}x${height} (aspect ${ratio.toFixed(3)}), not standard 16:9 (1.778). Auto-fitting to 1920x1080 center crop for audit.`
  );
}

const fontFile = hasDrawtextAndFont();
const dt = (text, x, y, color = "white", size = 24, box = "black@0.72") => {
  if (!fontFile) return "";
  const safeText = text.replace(/:/g, "\\:").replace(/'/g, "\\'");
  return `,drawtext=fontfile='${escFont(fontFile)}':text='${safeText}':x=${x}:y=${y}:fontsize=${size}:fontcolor=${color}:box=1:boxcolor=${box}:boxborderw=8`;
};

// 1. 归一化到 1920x1080 基准图并分出 5 路（1 路标注图 + 4 路真实平台裁切模拟）
const baseNorm =
  "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,split=5[full][c169][c11][c67][c34]";

// 2. 上半区：叠加四层安全参考框 + 右下角角标禁区
const overlayTop =
  "[full]" +
  // 两侧 3:4 以外区域轻微暗化，方便一眼看清竖版主页会被切掉的区域
  "drawbox=x=0:y=0:w=555:h=1080:color=black@0.32:t=fill," +
  "drawbox=x=1365:y=0:w=555:h=1080:color=black@0.32:t=fill," +
  // 1:1 青色边界 (1080x1080)
  "drawbox=x=420:y=0:w=1080:h=1080:color=0x00E5FF@0.9:t=3," +
  // 6:7 黄色边界 (926x1080)
  "drawbox=x=497:y=0:w=926:h=1080:color=0xFFD54F@0.9:t=3," +
  // 3:4 白色最严外框 (810x1080)
  "drawbox=x=555:y=0:w=810:h=1080:color=white@0.95:t=3," +
  // 翠绿色粗框：绝对安全核心区 (750x780, x=585..1335, y=140..920)
  "drawbox=x=585:y=140:w=750:h=780:color=0x00FF88@1.0:t=6," +
  // 中心准星十字淡线（辅助构图居中）
  "drawbox=x=959:y=140:w=2:h=780:color=0x00FF88@0.30:t=fill," +
  "drawbox=x=585:y=529:w=750:h=2:color=0x00FF88@0.30:t=fill," +
  // 红色角标禁区：16:9 右下角时长角标 + 3:4 卡片右下角角标
  "drawbox=x=1680:y=970:w=220:h=90:color=0xFF3B30@0.48:t=fill," +
  "drawbox=x=1680:y=970:w=220:h=90:color=0xFF3B30@0.95:t=3," +
  "drawbox=x=1195:y=960:w=160:h=90:color=0xFF3B30@0.48:t=fill," +
  "drawbox=x=1195:y=960:w=160:h=90:color=0xFF3B30@0.95:t=3" +
  dt("SAFE CORE 750x780 (ALL TITLES INSIDE GREEN)", 598, 152, "0x00FF88", 22) +
  dt("1:1", 430, 18, "0x00E5FF", 22) +
  dt("6:7", 506, 56, "0xFFD54F", 22) +
  dt("3:4", 564, 94, "white", 22) +
  dt("TIME BADGE", 1702, 1002, "white", 20, "0xFF3B30@0.85") +
  dt("BADGE", 1235, 992, "white", 18, "0xFF3B30@0.85") +
  "[top]";

// 3. 下半区：4 种平台真实裁切模拟（无安全框遮挡，纯看真实上线效果！）
const crop169 =
  "[c169]scale=540:304,pad=548:312:4:4:color=0x444B58" +
  dt("16:9 LANDSCAPE", 14, 14, "white", 18) +
  "[p169]";
const crop11 =
  "[c11]crop=1080:1080:420:0,scale=360:360,pad=368:368:4:4:color=0x00E5FF" +
  dt("1:1 SQUARE FEED", 14, 14, "0x00E5FF", 18) +
  "[p11]";
const crop67 =
  "[c67]crop=926:1080:497:0,scale=308:360,pad=316:368:4:4:color=0xFFD54F" +
  dt("6:7 VERTICAL FEED", 14, 14, "0xFFD54F", 18) +
  "[p67]";
const crop34 =
  "[c34]crop=810:1080:555:0,scale=270:360,pad=278:368:4:4:color=0x00FF88" +
  dt("3:4 PROFILE CARD", 14, 14, "0x00FF88", 18) +
  "[p34]";

// 4. 拼接下半区 1920x480 暗色展示台，并与上半区纵向堆叠成 1920x1560 终极审计图
const stripCompose =
  "color=c=0x111318:s=1920x480[strip0];" +
  "[strip0][p169]overlay=68:88[s1];" +
  "[s1][p11]overlay=694:60[s2];" +
  "[s2][p67]overlay=1140:60[s3];" +
  "[s3][p34]overlay=1534:60" +
  dt("REAL PLATFORM CROP PREVIEWS — VERIFY ZERO CLIPPED TITLE / SUBJECT ACROSS ALL 4 ASPECT RATIOS", 68, 16, "0xD0D7E2", 20, "0x111318@0.0") +
  "[bottom];" +
  "[top][bottom]vstack=inputs=2[out]";

const filterGraph = [baseNorm, overlayTop, crop169, crop11, crop67, crop34, stripCompose].join(";");

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    resolvedInput,
    "-filter_complex",
    filterGraph,
    "-map",
    "[out]",
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outputPath,
  ],
  { stdio: "inherit" }
);

console.log(`Cover safe-zone audit generated: ${outputPath}`);
console.log("Checklist:");
console.log("  1. All main title characters & focal subject sit 100% inside the GREEN 750x780 core box.");
console.log("  2. No text touches the RED bottom-right duration badge zones.");
console.log("  3. All 4 bottom real-crop previews (16:9 / 1:1 / 6:7 / 3:4) read cleanly without clipping.");

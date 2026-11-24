#!/usr/bin/env bash
# GoodTake V2.1 — 双引擎（HyperFrames & Remotion）校验、渲染、审片与打包脚本
#
# 用法：
#   ./render_and_package.sh check       <project_dir> [--engine hyperframes|remotion]
#   ./render_and_package.sh snap        <project_dir> <t1,t2,...> [out_dir] [--engine hyperframes|remotion] [--comp CompId] [--fps 30]
#   ./render_and_package.sh render      <project_dir> <output_slug> [cover_sec] [--engine hyperframes|remotion] [--comp CompId]
#   ./render_and_package.sh review-prep <video_mp4> [out_dir] [seg_sec]
#
# 说明：
#   - 多模态原生支持视频/音频的模型，渲染后请优先直接读取 MP4 整片看+听审片；
#     若单文件超过模型体积或时长上限，用 review-prep 一键生成 720p 轻量化整片审片版及分段。
#   - snap 适用于渲染前快速排错，或不支持原生看视频模型的 24 帧联系表降级审片。
set -euo pipefail

CMD="${1:-}"
ARG2="${2:-}"
HF_VER="hyperframes@0.8.191"
ENGINE="hyperframes"
COMP_ID="Main"
FPS=30

if [[ -z "$CMD" || -z "$ARG2" ]]; then
  echo "Usage:"
  echo "  $0 check       <project_dir> [--engine hyperframes|remotion]"
  echo "  $0 snap        <project_dir> <t1,t2,...> [out_dir] [--engine hyperframes|remotion] [--comp CompId] [--fps 30]"
  echo "  $0 render      <project_dir> <output_slug> [cover_sec] [--engine hyperframes|remotion] [--comp CompId]"
  echo "  $0 review-prep <video_mp4> [out_dir] [seg_sec]"
  exit 1
fi

shift 2
POS_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --engine) ENGINE="${2:?Missing engine}"; shift 2 ;;
    --comp)   COMP_ID="${2:?Missing comp}"; shift 2 ;;
    --fps)    FPS="${2:?Missing fps}"; shift 2 ;;
    *)        POS_ARGS+=("$1"); shift ;;
  esac
done

# review-prep 不要求 $ARG2 是项目目录，直接接收 MP4 文件路径
if [[ "$CMD" == "review-prep" ]]; then
  VIDEO_MP4="$ARG2"
  if [[ ! -f "$VIDEO_MP4" ]]; then
    echo "Error: video file not found: $VIDEO_MP4" >&2
    exit 1
  fi
  OUT_DIR="${POS_ARGS[0]:-/tmp/cinema_review}"
  SEG_SEC="${POS_ARGS[1]:-75}"
  rm -rf "$OUT_DIR" && mkdir -p "$OUT_DIR"

  echo "=== 1/2 Building Lightweight 720p Full Review Video (for Native Multimodal Watch+Listen) ==="
  REVIEW_FULL="$OUT_DIR/review_full_720p.mp4"
  ffmpeg -y -hide_banner -loglevel error -i "$VIDEO_MP4" \
    -vf "scale=1280:720:flags=lanczos" \
    -c:v libx264 -preset fast -crf 24 -pix_fmt yuv420p \
    -c:a aac -b:a 128k -movflags +faststart "$REVIEW_FULL"

  echo "=== 2/2 Splitting into ${SEG_SEC}s Segments (for Full-Coverage Review under Size/Duration Caps) ==="
  ffmpeg -y -hide_banner -loglevel error -i "$REVIEW_FULL" \
    -c copy -f segment -segment_time "$SEG_SEC" -reset_timestamps 1 \
    "$OUT_DIR/review_part_%02d.mp4"

  echo "Ready for native multimodal video+audio review:"
  ls -lh "$OUT_DIR"/review_*.mp4
  exit 0
fi

PROJ="$ARG2"
cd "$PROJ"

build_contact_sheets() {
  local dir="$1"
  node -e '
    const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
    const dir = process.argv[1];
    const files = fs.readdirSync(dir).filter(f => f.startsWith("frame-") && f.endsWith(".png")).sort().map(f => path.join(dir, f));
    if (!files.length) throw new Error("No snapshot PNGs found in " + dir);
    const sheets = Math.ceil(files.length / 6);
    for (let g = 0; g < sheets; g++) {
      const chunk = files.slice(g * 6, g * 6 + 6);
      while (chunk.length < 6) chunk.push(chunk[chunk.length - 1]);
      const args = ["-y", "-hide_banner", "-loglevel", "error"];
      chunk.forEach(f => args.push("-i", f));
      args.push("-filter_complex",
        "[0:v]scale=640:360[v0];[1:v]scale=640:360[v1];[2:v]scale=640:360[v2];" +
        "[3:v]scale=640:360[v3];[4:v]scale=640:360[v4];[5:v]scale=640:360[v5];" +
        "[v0][v1][v2]hstack=3[top];[v3][v4][v5]hstack=3[bot];[top][bot]vstack=2",
        "-q:v", "2", path.join(dir, `contact_sheet_${g + 1}.jpg`)
      );
      execFileSync("ffmpeg", args);
    }
    console.log(`Generated ${sheets} contact sheets in ${dir}`);
  ' "$dir"
  ls -lh "$dir"/contact_sheet_*.jpg
}

case "$CMD" in
  check)
    if [[ "$ENGINE" == "remotion" ]]; then
      npx tsc --noEmit
    else
      npx --yes "$HF_VER" check
    fi
    ;;

  snap)
    TIMES="${POS_ARGS[0]:?Missing comma-separated timestamps}"
    OUT_DIR="${POS_ARGS[1]:-/tmp/cinema_snaps}"
    rm -rf "$OUT_DIR" && mkdir -p "$OUT_DIR"
    if [[ "$ENGINE" == "remotion" ]]; then
      IFS=',' read -ra ARR <<< "$TIMES"
      idx=0
      for sec in "${ARR[@]}"; do
        frame=$(node -e "console.log(Math.round(parseFloat(process.argv[1]) * parseInt(process.argv[2],10)))" "$sec" "$FPS")
        printf -v pad "%02d" "$idx"
        npx remotion still "$COMP_ID" "$OUT_DIR/frame-${pad}-at-${sec}s.png" --frame="$frame"
        idx=$((idx + 1))
      done
    else
      npx --yes "$HF_VER" snapshot --at "$TIMES" --output "$OUT_DIR"
    fi
    build_contact_sheets "$OUT_DIR"
    ;;

  render)
    SLUG="${POS_ARGS[0]:-cinema-output}"
    COVER_SEC="${POS_ARGS[1]:-7.5}"
    mkdir -p renders
    MASTER="renders/${SLUG}-master.mp4"
    WEB="renders/${SLUG}-web.mp4"
    COVER_REF="renders/${SLUG}-frame-ref.jpg"

    echo "=== 1/4 Rendering 1080p High Master (engine=$ENGINE) ==="
    if [[ "$ENGINE" == "remotion" ]]; then
      npx remotion render "$COMP_ID" "$MASTER" --codec=h264 --crf=17 --pixel-format=yuv420p
    else
      npx --yes "$HF_VER" render --quality high --output "$MASTER"
    fi

    echo "=== 2/4 FFprobe Stream Audit ==="
    ffprobe -v error -show_entries format=duration,size,bit_rate \
      -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels "$MASTER"

    echo "=== 3/4 Encoding Faststart Web/Publish Edition (CRF 21) ==="
    ffmpeg -y -hide_banner -loglevel error -i "$MASTER" \
      -c:v libx264 -preset fast -crf 21 -pix_fmt yuv420p \
      -c:a aac -b:a 192k -movflags +faststart "$WEB"

    echo "=== 4/4 Extracting Reference Frame @ ${COVER_SEC}s (NOTE: Formal cover MUST be dedicated & audited via verify_cover_safezone.mjs) ==="
    ffmpeg -y -hide_banner -loglevel error -ss "$COVER_SEC" -i "$MASTER" -frames:v 1 -q:v 2 "$COVER_REF"

    ls -lh "$MASTER" "$WEB" "$COVER_REF"
    echo ""
    echo "Next QA steps:"
    echo "  1. Native multimodal video models: directly watch & listen to the full MP4 (or run 'review-prep $MASTER' if file exceeds single-read limits)."
    echo "  2. Cover audit: design a dedicated no-subtitle cover locked inside 750x780 center safe core and run verify_cover_safezone.mjs."
    ;;

  *)
    echo "Unknown command: $CMD (expected check | snap | render | review-prep)"
    exit 1
    ;;
esac

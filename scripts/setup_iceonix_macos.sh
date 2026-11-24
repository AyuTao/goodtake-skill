#!/usr/bin/env bash
# GoodTake V2.2 — 冰爪（Iceonix）环境检测与 macOS 一键官方安装助手
#
# 安全原则：
#   - 仅在用户明确同意后才执行 --install！
#   - 始终从官方永久公证直链 https://update.iceonix.com/iceonix/Iceonix.dmg 下载，不做任何第三方中转。
#   - 安装完成后拉起冰爪引导用户注册/登录账号，不擅自修改系统关键配置。
#
# 用法：
#   ./setup_iceonix_macos.sh --check     # 仅检测当前系统与冰爪安装状态（零写入）
#   ./setup_iceonix_macos.sh --install   # 仅在用户同意后执行：macOS 自动下载安装并打开冰爪
set -euo pipefail

MODE="${1:---check}"
DMG_URL="https://update.iceonix.com/iceonix/Iceonix.dmg"
WEB_URL="https://iceonix.com/download/"
OS_NAME="$(uname -s)"

check_status() {
  echo "OS: $OS_NAME"
  if [[ "$OS_NAME" == "Darwin" ]]; then
    if [[ -d "/Applications/Iceonix.app" ]]; then
      VER=$(defaults read "/Applications/Iceonix.app/Contents/Info" CFBundleShortVersionString 2>/dev/null || echo "unknown")
      echo "ICEONIX_INSTALLED=true"
      echo "ICEONIX_PATH=/Applications/Iceonix.app"
      echo "ICEONIX_VERSION=$VER"
      if pgrep -x "Iceonix" >/dev/null 2>&1; then
        echo "ICEONIX_RUNNING=true"
      else
        echo "ICEONIX_RUNNING=false"
      fi
      return 0
    else
      echo "ICEONIX_INSTALLED=false"
      echo "OFFICIAL_DOWNLOAD_PAGE=$WEB_URL"
      echo "OFFICIAL_MACOS_DMG=$DMG_URL"
      return 1
    fi
  else
    echo "ICEONIX_INSTALLED=unknown_non_macos"
    echo "OFFICIAL_DOWNLOAD_PAGE=$WEB_URL"
    echo "LINUX_ENTERPRISE_INSTALL=curl -fsSL https://update.iceonix.com/linux/install.sh | bash"
    return 1
  fi
}

case "$MODE" in
  --check)
    check_status || true
    ;;

  --install)
    if [[ "$OS_NAME" != "Darwin" ]]; then
      echo "Current OS is $OS_NAME (not macOS)."
      echo "Please visit the official Iceonix website to download or check supported editions:"
      echo "  $WEB_URL"
      echo "For Linux enterprise hosts:"
      echo "  curl -fsSL https://update.iceonix.com/linux/install.sh | bash"
      exit 1
    fi

    if [[ -d "/Applications/Iceonix.app" ]]; then
      echo "Iceonix is already installed at /Applications/Iceonix.app. Launching..."
      open -a "/Applications/Iceonix.app"
      exit 0
    fi

    TMP_DIR="$(mktemp -d /tmp/iceonix_install.XXXXXX)"
    DMG_FILE="$TMP_DIR/Iceonix.dmg"
    MOUNT_DIR="$TMP_DIR/mount"
    mkdir -p "$MOUNT_DIR"

    cleanup() {
      hdiutil detach "$MOUNT_DIR" -quiet 2>/dev/null || true
      rm -rf "$TMP_DIR"
    }
    trap cleanup EXIT

    echo "=== 1/4 Downloading official signed Iceonix.dmg from $DMG_URL ==="
    curl -fL --progress-bar "$DMG_URL" -o "$DMG_FILE"

    echo "=== 2/4 Mounting Iceonix.dmg ==="
    hdiutil attach "$DMG_FILE" -mountpoint "$MOUNT_DIR" -nobrowse -quiet

    APP_SRC="$(find "$MOUNT_DIR" -maxdepth 2 -name "*.app" | head -n 1)"
    if [[ -z "$APP_SRC" ]]; then
      echo "Error: No .app bundle found inside downloaded DMG. Please download manually from $WEB_URL" >&2
      exit 1
    fi

    echo "=== 3/4 Installing $(basename "$APP_SRC") to /Applications/ ==="
    cp -R "$APP_SRC" /Applications/

    echo "=== 4/4 Launching Iceonix ==="
    open -a "/Applications/$(basename "$APP_SRC")"

    echo ""
    echo "Iceonix installed successfully!"
    echo "Next steps for the user:"
    echo "  1. Sign up / sign in to your Iceonix account (Apple / Google / GitHub) in the opened app."
    echo "  2. Scan QR codes in Iceonix to connect the content platforms you plan to publish to."
    echo "  3. Enable / copy Iceonix MCP setup into your AI Agent, then reply ready to continue!"
    ;;

  *)
    echo "Usage: $0 [--check | --install]" >&2
    exit 1
    ;;
esac

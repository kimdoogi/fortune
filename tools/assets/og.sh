#!/usr/bin/env bash
# 공유 미리보기 이미지 찍기 (docs/16 §1, D-082).
#   개발 서버를 켠 뒤(pnpm --filter @fortune/web dev, 5173) 실행: tools/assets/og.sh [주소]
#   → apps/web/public/og.jpg (1200×630, 약 150KB), apple-touch-icon.png (180×180)
set -euo pipefail
BASE="${1:-http://localhost:5173}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/apps/web/public"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

shot() { # 주소, 가로, 세로, 저장 파일
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=8000 --user-data-dir="$TMP/profile" \
    --screenshot="$4" "$1" >/dev/null 2>&1
}

shot "$BASE/og.html" 1200 630 "$TMP/og.png"
# PNG는 440KB라 JPEG로 줄인다 (8비트 팔레트 PNG는 밤하늘 그라데이션에 띠가 생김)
ffmpeg -hide_banner -loglevel error -y -i "$TMP/og.png" -q:v 2 "$OUT/og.jpg"
shot "$BASE/og.html?icon=1" 180 180 "$TMP/icon.png"
cp "$TMP/icon.png" "$OUT/apple-touch-icon.png"
for f in og.jpg apple-touch-icon.png; do
  printf "%s %s %s bytes\n" "$f" "$(sips -g pixelWidth -g pixelHeight "$OUT/$f" | awk '/pixel/{printf "%s ", $2}')" "$(stat -f %z "$OUT/$f")"
done

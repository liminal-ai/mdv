#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_ICON="$ROOT_DIR/assets/icon/source/icon-master.png"
GENERATED_DIR="$ROOT_DIR/assets/icon/generated"
ICONSET_DIR="$GENERATED_DIR/md-viewer.iconset"
ICNS_FILE="$ROOT_DIR/assets/icon/md-viewer.icns"
FAVICON_16="$ROOT_DIR/assets/icon/favicon-16.png"
FAVICON_32="$ROOT_DIR/assets/icon/favicon-32.png"

mkdir -p "$GENERATED_DIR"

if [[ ! -f "$SOURCE_ICON" ]]; then
  "$ROOT_DIR/scripts/generate-icon.sh"
fi

rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -z 16 16 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 64 64 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$SOURCE_ICON" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"

sips -z 16 16 "$SOURCE_ICON" --out "$FAVICON_16" >/dev/null
sips -z 32 32 "$SOURCE_ICON" --out "$FAVICON_32" >/dev/null

cp "$FAVICON_16" "$ROOT_DIR/src/renderer/favicon-16.png"
cp "$FAVICON_32" "$ROOT_DIR/src/renderer/favicon-32.png"

echo "Built icon artifacts:"
echo "- $ICNS_FILE"
echo "- $FAVICON_16"
echo "- $FAVICON_32"

#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/Applications"
APP_NAME="mdv.app"

echo "Building MD Viewer..."
npm run build:electron

echo "Packaging..."
npx electron-builder --mac --dir

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  SOURCE="dist/electron/mac-arm64/$APP_NAME"
else
  SOURCE="dist/electron/mac/$APP_NAME"
fi

if [ ! -d "$SOURCE" ]; then
  echo "Error: Build output not found at $SOURCE"
  exit 1
fi

echo "Installing to $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/$APP_NAME"
cp -R "$SOURCE" "$INSTALL_DIR/$APP_NAME"

echo "MD Viewer installed to $INSTALL_DIR/$APP_NAME"
echo "You can now open it from ~/Applications or set it as your default .md handler."

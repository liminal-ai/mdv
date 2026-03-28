#!/bin/bash
set -euo pipefail

INSTALL_DIR="$HOME/Applications"
APP_NAME="mdv.app"
LSREGISTER="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
BUNDLE_ID="com.leemoore.mdviewer"

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
osascript -e "tell application id \"$BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
sleep 1

mkdir -p "$INSTALL_DIR"
rm -rf "$INSTALL_DIR/$APP_NAME"
cp -R "$SOURCE" "$INSTALL_DIR/$APP_NAME"

if [ -x "$LSREGISTER" ]; then
  while IFS= read -r existing_app; do
    if [ -z "$existing_app" ] || [ "$existing_app" = "$INSTALL_DIR/$APP_NAME" ]; then
      continue
    fi

    if [ -d "$existing_app" ]; then
      echo "Unregistering conflicting bundle: $existing_app"
      "$LSREGISTER" -u "$existing_app" >/dev/null 2>&1 || true
    fi
  done < <(mdfind "kMDItemCFBundleIdentifier == '$BUNDLE_ID'" || true)

  "$LSREGISTER" -u "$PWD/dist/electron/mac-arm64/$APP_NAME" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$PWD/dist/electron/mac/$APP_NAME" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$PWD/out/MD Viewer-darwin-arm64/MD Viewer.app" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "/Applications/MD Viewer.app" >/dev/null 2>&1 || true
  "$LSREGISTER" -u "$HOME/Applications/MD Viewer.app" >/dev/null 2>&1 || true

  echo "Registering app bundle with Launch Services..."
  "$LSREGISTER" -f "$INSTALL_DIR/$APP_NAME" >/dev/null
fi

touch "$INSTALL_DIR/$APP_NAME"

echo "MD Viewer installed to $INSTALL_DIR/$APP_NAME"
echo "You can now open it from ~/Applications or set it as your default .md handler."

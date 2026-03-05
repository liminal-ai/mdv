#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PROMPT_FILE="$ROOT_DIR/assets/icon/icon-prompt.md"
OUT_DIR="$ROOT_DIR/assets/icon/source"
OUT_FILE="$OUT_DIR/icon-master.png"

mkdir -p "$OUT_DIR"

if [[ -n "${OPENAI_API_KEY:-}" ]]; then
  CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
  IMAGE_GEN="$CODEX_HOME/skills/imagegen/scripts/image_gen.py"

  if [[ -f "$IMAGE_GEN" ]]; then
    echo "Generating icon via imagegen skill..."
    python3 "$IMAGE_GEN" generate \
      --prompt-file "$PROMPT_FILE" \
      --size 1024x1024 \
      --quality high \
      --out "$OUT_FILE" \
      --output-format png
    echo "Generated icon source: $OUT_FILE"
    exit 0
  fi

  echo "imagegen script not found at $IMAGE_GEN; using fallback icon generator."
else
  echo "OPENAI_API_KEY not set; using fallback icon generator."
fi

swift "$ROOT_DIR/scripts/create-fallback-icon.swift" "$OUT_FILE"

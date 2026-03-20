#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  echo "[smoke] package.json not present yet, skipping smoke"
  exit 0
fi

echo "[smoke] placeholder"
echo "[smoke] replace with gateway startup and HTTP verification once the app exists"

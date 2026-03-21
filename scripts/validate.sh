#!/usr/bin/env bash
# Delivery gate script [AC5]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_if_present() {
  local label="$1"
  shift
  if "$@"; then
    return 0
  fi
  return 1
}

if [ -f package.json ] && [ -d node_modules ]; then
  echo "[validate] pnpm run lint"
  pnpm run lint
  echo "[validate] pnpm run typecheck"
  pnpm run typecheck
  echo "[validate] pnpm test"
  pnpm test
  echo "[validate] pnpm run build"
  pnpm run build
else
  echo "[validate] package.json or node_modules missing, skipping lint/typecheck/test/build"
fi

echo "[validate] architecture checks"
bash scripts/check-architecture.sh

echo "[validate] AC coverage checks"
bash scripts/check-ac-coverage.sh

echo "[validate] smoke checks"
bash scripts/smoke.sh

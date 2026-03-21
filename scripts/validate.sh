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

# Frontend validation [Phase 3 AC6]
if [ -f frontend/package.json ]; then
  if [ ! -d frontend/node_modules ]; then
    echo "[validate] frontend/node_modules missing, installing frontend deps"
    pnpm --dir frontend install --frozen-lockfile
  fi
  echo "[validate] frontend lint"
  pnpm --dir frontend run lint
  echo "[validate] frontend typecheck"
  pnpm --dir frontend run typecheck
  echo "[validate] frontend test"
  pnpm --dir frontend test
  echo "[validate] frontend build"
  pnpm --dir frontend run build
else
  echo "[validate] frontend/package.json not found, skipping frontend checks"
fi

echo "[validate] architecture checks"
bash scripts/check-architecture.sh

echo "[validate] AC coverage checks"
bash scripts/check-ac-coverage.sh

echo "[validate] smoke checks"
bash scripts/smoke.sh

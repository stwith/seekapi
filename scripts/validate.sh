#!/usr/bin/env bash
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

if command -v pnpm >/dev/null 2>&1 && [ -f package.json ]; then
  echo "[validate] pnpm lint"
  pnpm lint
  echo "[validate] pnpm typecheck"
  pnpm typecheck
  echo "[validate] pnpm test"
  pnpm test
  echo "[validate] pnpm build"
  pnpm build
else
  echo "[validate] package manager or package.json missing, skipping lint/typecheck/test/build"
fi

echo "[validate] architecture checks"
bash scripts/check-architecture.sh

echo "[validate] AC coverage checks"
bash scripts/check-ac-coverage.sh

echo "[validate] smoke checks"
bash scripts/smoke.sh

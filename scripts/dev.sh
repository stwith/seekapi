#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[dev] start local dependencies and application here"
echo "[dev] expected future flow:"
echo "  1. start postgres and redis"
echo "  2. run migrations"
echo "  3. seed demo data"
echo "  4. start the gateway"

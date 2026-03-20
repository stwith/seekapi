#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d docs/plans ]; then
  echo "[check-ac-coverage] docs/plans not present, skipping"
  exit 0
fi

latest_plan="$(find docs/plans -maxdepth 1 -type f -name '*.md' ! -name 'TEMPLATE.md' | sort | tail -n 1)"

if [ -z "${latest_plan:-}" ]; then
  echo "[check-ac-coverage] no active plan found, skipping"
  exit 0
fi

acs="$(grep -o 'AC[0-9]\+' "$latest_plan" | sort | uniq || true)"

if [ -z "${acs:-}" ]; then
  echo "[check-ac-coverage] no AC labels found in $latest_plan, skipping"
  exit 0
fi

search_targets=()

for path in src tests scripts docs examples AGENTS.md README.md; do
  if [ -e "$path" ]; then
    search_targets+=("$path")
  fi
done

if [ "${#search_targets[@]}" -eq 0 ]; then
  echo "[check-ac-coverage] no searchable targets found, skipping"
  exit 0
fi

for ac in $acs; do
  if ! rg -n "$ac" "${search_targets[@]}" >/dev/null 2>&1; then
    echo "FAIL: missing coverage for $ac"
    echo "Action: add a test, smoke check, or validation artifact labeled $ac"
    exit 1
  fi
done

echo "[check-ac-coverage] passed for $latest_plan"

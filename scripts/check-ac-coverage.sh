#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d docs/plans ]; then
  echo "[check-ac-coverage] docs/plans not present, skipping"
  exit 0
fi

plans="$(
  ls docs/plans/*.md 2>/dev/null \
    | grep -v '/TEMPLATE\.md$' \
    || true
)"

if [ -z "${plans:-}" ]; then
  echo "[check-ac-coverage] no active plans found, skipping"
  exit 0
fi

search_targets=()

for path in .github src tests scripts docs examples AGENTS.md README.md; do
  if [ -e "$path" ]; then
    search_targets+=("$path")
  fi
done

if [ "${#search_targets[@]}" -eq 0 ]; then
  echo "[check-ac-coverage] no searchable targets found, skipping"
  exit 0
fi

for plan in $plans; do
  acs="$(grep -o 'AC[0-9]\+' "$plan" | sort | uniq || true)"

  if [ -z "${acs:-}" ]; then
    continue
  fi

  for ac in $acs; do
    if ! grep -R -n -- "$ac" "${search_targets[@]}" >/dev/null 2>&1; then
      echo "FAIL: missing coverage for $ac in $plan"
      echo "Action: add a test, smoke check, or validation artifact labeled $ac"
      exit 1
    fi
  done

  echo "[check-ac-coverage] passed for $plan"
done

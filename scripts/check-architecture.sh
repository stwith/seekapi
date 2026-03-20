#!/usr/bin/env bash
# Architecture boundary enforcement [AC2]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d src ]; then
  echo "[check-architecture] src/ not present yet, skipping source checks"
  exit 0
fi

if rg -n 'from .*(repo|repository)|require\(.*(repo|repository).*\)' src/modules/*/http src/modules/*/controller 2>/dev/null; then
  echo "FAIL: transport layer appears to access repository directly"
  echo "Action: route handlers/controllers must call services, not repositories"
  exit 1
fi

if rg -n 'FastifyReply|\bResponse\b|res\.' src/modules/*/service 2>/dev/null; then
  echo "FAIL: service layer appears to depend on HTTP response objects"
  echo "Action: return domain results from services and shape HTTP responses in the transport layer"
  exit 1
fi

echo "[check-architecture] passed"

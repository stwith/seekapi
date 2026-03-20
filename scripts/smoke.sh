#!/usr/bin/env bash
# Smoke checks for main runnable path [AC6]
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f package.json ]; then
  echo "[smoke] package.json not present yet, skipping smoke"
  exit 0
fi

if [ ! -d node_modules ]; then
  echo "[smoke] node_modules missing, skipping smoke"
  exit 0
fi

SMOKE_PORT=19876

echo "[smoke] building app"
npm run build --silent

echo "[smoke] starting server on port $SMOKE_PORT"
PORT=$SMOKE_PORT node dist/app/server.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to be ready (up to 5 seconds)
SMOKE_URL=""
for _i in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:$SMOKE_PORT/v1/health" >/dev/null 2>&1; then
    SMOKE_URL="http://127.0.0.1:$SMOKE_PORT"
    break
  fi
  sleep 0.1
done

if [ -z "$SMOKE_URL" ]; then
  echo "[smoke] FAIL: server did not become ready within 5 seconds"
  exit 1
fi

echo "[smoke] server ready at $SMOKE_URL"

echo "[smoke] checking GET /v1/health"
HEALTH_RESPONSE=$(curl -sf "$SMOKE_URL/v1/health")
if echo "$HEALTH_RESPONSE" | grep -q '"status":"ok"'; then
  echo "[smoke] /v1/health ok"
else
  echo "[smoke] FAIL: /v1/health returned unexpected response: $HEALTH_RESPONSE"
  exit 1
fi

echo "[smoke] passed"

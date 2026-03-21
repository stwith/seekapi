# Local Development & Verification Checklist

How to run SeekAPI locally, seed demo data, and verify the Brave search path end-to-end.

## 1. Prerequisites

- Node.js 20+
- (Optional) Docker for PostgreSQL and Redis

## 2. Install Dependencies

```bash
npm install
```

## 3. Set Environment Variables

Copy the template and fill in your values:

```bash
cp .env.example .env
# Edit .env with your actual values
```

The `npm run dev`, `npm start`, `npm run db:generate`, and `npm run db:migrate` scripts automatically load `.env` via Node's `--env-file-if-exists` flag. No manual `source` or `export` is needed.

| Variable | Required | Description | Default |
|---|---|---|---|
| `ENCRYPTION_KEY` | **Yes** | 32-byte hex key for credential encryption at rest | — |
| `BRAVE_API_KEY` | For search | Your Brave Search API key (BYOK) | — |
| `PORT` | No | Server listen port | `3000` |
| `HOST` | No | Bind address | `0.0.0.0` |
| `DATABASE_URL` | No | PostgreSQL connection string (enables durable persistence for usage events, audit logs, health snapshots) | in-memory |
| `REDIS_URL` | No | Redis connection string (enables durable rate limiting) | in-memory |
| `SEED_API_KEY` | No | Downstream API key for the seed project | `sk_test_seekapi_demo_key_001` |
| `SEED_PROJECT_ID` | No | ID of the seed project | `proj_demo_001` |
| `SEED_PROJECT_NAME` | No | Display name for the seed project | `Demo Project` |
| `LOG_LEVEL` | No | Pino log level | `info` |

### Minimal `.env` for local smoke testing

```bash
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

This gives you a running server with in-memory stores. Searches will fail without `BRAVE_API_KEY`.

### Full `.env` for Brave search testing

```bash
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
BRAVE_API_KEY=BSA...your-key...
```

## 4. Start Dependencies (Optional)

PostgreSQL and Redis are **not required** for running tests or local smoke testing. The server uses in-memory stubs by default. Use them when you want:

- **PostgreSQL** (`DATABASE_URL`): Durable persistence for usage events, audit logs, and health snapshots
- **Redis** (`REDIS_URL`): Durable rate limiting (gracefully degrades to in-memory if unavailable)

```bash
docker run -d --name seekapi-pg -e POSTGRES_USER=seekapi -e POSTGRES_PASSWORD=seekapi -e POSTGRES_DB=seekapi -p 5432:5432 postgres:16
docker run -d --name seekapi-redis -p 6379:6379 redis:7
```

If using PostgreSQL, run migrations:

```bash
npm run db:migrate
```

## 5. Bootstrap Flow

The server (`server.ts`) auto-seeds on startup — no manual seeding needed:

1. Creates an in-memory API key record from `SEED_API_KEY`
2. Creates a project (`SEED_PROJECT_ID`) with Brave bindings for web, news, and images
3. If `BRAVE_API_KEY` is set: encrypts and stores the credential for the seed project
4. If `DATABASE_URL` is set: uses Drizzle-backed repositories for usage/audit/health; otherwise in-memory
5. If `BRAVE_API_KEY` is set: configures health probes to use the seed project's credential, so `/v1/health/providers` reports real Brave readiness

## 6. Start the Application

```bash
# Development mode (hot reload)
npm run dev

# Or production mode
npm run build && npm start
```

The server starts on `http://localhost:3000` by default.

## 7. Verify Endpoints

### Health check (public, no auth required)

```bash
curl http://localhost:3000/v1/health
# → {"status":"ok","timestamp":"..."}
```

### Provider health (requires auth)

```bash
curl -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  http://localhost:3000/v1/health/providers
```

Expected responses depending on setup:

| Setup | Brave status |
|---|---|
| `BRAVE_API_KEY` set with valid key | `"healthy"` (real probe) |
| `BRAVE_API_KEY` set but invalid | `"degraded"` (probe failed) |
| `BRAVE_API_KEY` not set | `"unavailable"` (no credential to probe) |

### Web search (requires auth + Brave API key)

```bash
curl -X POST http://localhost:3000/v1/search/web \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query": "hello world"}'
# → {"capability":"search.web","provider":"brave","request_id":"...","items":[...]}
```

### News search

```bash
curl -X POST http://localhost:3000/v1/search/news \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query": "latest news"}'
```

### Image search

```bash
curl -X POST http://localhost:3000/v1/search/images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query": "cats"}'
```

## 8. Run the Full Delivery Gate

The single command that validates everything:

```bash
bash scripts/validate.sh
```

This runs, in order:

1. **Lint** — `npm run lint`
2. **Type-check** — `npm run typecheck`
3. **Tests** — `npm test` (185+ tests across 20 files)
4. **Build** — `npm run build`
5. **Architecture checks** — `bash scripts/check-architecture.sh`
6. **AC coverage checks** — `bash scripts/check-ac-coverage.sh`
7. **Smoke checks** — `bash scripts/smoke.sh` (builds, starts server, hits `/v1/health`)

All steps must pass before a PR can be merged.

## 9. Manual Brave Smoke Check

A step-by-step verification that the full Brave path works:

```bash
# 1. Set up
export ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
export BRAVE_API_KEY=BSA...your-key...

# 2. Start server
npm run dev &
sleep 2

# 3. Gateway health (no auth)
curl -s http://localhost:3000/v1/health | jq .
# Expect: {"status":"ok","timestamp":"..."}

# 4. Provider health (auth required, uses real Brave credential)
curl -s -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  http://localhost:3000/v1/health/providers | jq .
# Expect: providers[0].status == "healthy"

# 5. Web search
curl -s -X POST http://localhost:3000/v1/search/web \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query":"hello world"}' | jq '.items | length'
# Expect: > 0

# 6. News search
curl -s -X POST http://localhost:3000/v1/search/news \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query":"tech"}' | jq '.items | length'
# Expect: > 0

# 7. Image search
curl -s -X POST http://localhost:3000/v1/search/images \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query":"cats"}' | jq '.items | length'
# Expect: > 0

# 8. Rate limiting (hit limit to verify 429)
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
    http://localhost:3000/v1/health/providers
done | sort | uniq -c
# Expect: 100 × "200", then "429"s
```

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ENCRYPTION_KEY is required` | Missing env var | Set `ENCRYPTION_KEY` in `.env` |
| `401 UNAUTHORIZED` | Missing or wrong API key | Use `Authorization: Bearer sk_test_seekapi_demo_key_001` |
| `429 RATE_LIMITED` | Too many requests | Wait for window reset (~60s), or restart (in-memory rate limiter resets on restart) |
| Brave returns empty results | Invalid `BRAVE_API_KEY` | Set a valid key in `.env` |
| `ECONNREFUSED` on port 3000 | Server not running | Run `npm run dev` |
| Redis connection error | `REDIS_URL` set but Redis not running | Start Redis or unset `REDIS_URL` (falls back to in-memory) |
| Health providers shows `"unavailable"` | `BRAVE_API_KEY` not set | Set `BRAVE_API_KEY` to enable real health probes |
| Health providers shows `"degraded"` | Brave API returning errors | Check `BRAVE_API_KEY` validity / Brave API status |

See [docs/debugging.md](../debugging.md) for the full debugging guide.

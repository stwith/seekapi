# Local Development & Verification Checklist

How to run SeekAPI locally, seed demo data, and verify the MVP end-to-end.

## 1. Start Dependencies

SeekAPI requires PostgreSQL and Redis. The simplest way is Docker Compose (or run them natively):

```bash
# Docker one-liners (or use your preferred method)
docker run -d --name seekapi-pg -e POSTGRES_USER=seekapi -e POSTGRES_PASSWORD=seekapi -e POSTGRES_DB=seekapi -p 5432:5432 postgres:16
docker run -d --name seekapi-redis -p 6379:6379 redis:7
```

> **Note:** PostgreSQL and Redis are optional for running tests — the test suite uses in-memory stubs. They are required only for running the live server with persistent state.

## 2. Set Environment Variables

Copy the template and fill in your values:

```bash
cp .env.example .env
# Edit .env with your actual values (e.g. BRAVE_API_KEY)
```

The `npm run dev`, `npm start`, `npm run db:generate`, and `npm run db:migrate` scripts automatically load `.env` via Node's `--env-file-if-exists` flag. No manual `source` or `export` is needed.

Key variables:

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server listen port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://seekapi:seekapi@localhost:5432/seekapi` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ENCRYPTION_KEY` | 32-byte hex key for credential encryption at rest | (see `.env.example`) |
| `BRAVE_API_KEY` | Your Brave Search API key (BYOK) | — |
| `LOG_LEVEL` | Pino log level | `info` |

## 3. Install Dependencies

```bash
npm install
```

## 4. Run Migrations

Once PostgreSQL is running:

```bash
npm run db:migrate
```

> **Note:** In the current MVP, auth and credential resolution use in-memory stores, so migrations are not strictly required for local smoke testing. They will become required when repository-backed persistence is wired.

## 5. Seed Demo Data

```bash
bash scripts/seed-demo-data.sh
```

The built-in in-memory credential service already recognizes a demo project (`proj_demo_001`) with API key `sk_test_seekapi_demo_key_001` and a Brave BYOK credential. No external seeding is needed for basic smoke testing.

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
# → {"providers":[{"id":"brave","status":"healthy"|"degraded"|"unknown",...}]}
```

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
3. **Tests** — `npm test` (122 tests across 16 files)
4. **Build** — `npm run build`
5. **Architecture checks** — `bash scripts/check-architecture.sh`
6. **AC coverage checks** — `bash scripts/check-ac-coverage.sh`
7. **Smoke checks** — `bash scripts/smoke.sh` (builds, starts server, hits `/v1/health`)

All steps must pass before a PR can be merged.

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `401 UNAUTHORIZED` | Missing or wrong API key | Use `Authorization: Bearer sk_test_seekapi_demo_key_001` |
| `429 RATE_LIMITED` | Too many requests | Wait or restart (in-memory rate limiter resets on restart) |
| Brave returns empty results | Invalid `BRAVE_API_KEY` | Set a valid key in `.env` |
| `ECONNREFUSED` on port 3000 | Server not running | Run `npm run dev` |
| Redis connection error | `REDIS_URL` set but Redis not running | Start Redis or unset `REDIS_URL` (falls back to in-memory) |

See [docs/debugging.md](../debugging.md) for the full debugging guide.

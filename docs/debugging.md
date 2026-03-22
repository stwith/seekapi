# Debugging Guide

## Purpose

This document explains the debugging workflow for SeekAPI.
It covers system startup, data preparation, smoke checks, and common failure points.

## Standard Flow

1. Set required env vars (`ENCRYPTION_KEY`, optionally `BRAVE_API_KEY`, `TAVILY_API_KEY`, `KAGI_API_KEY`).
2. Start the app (`pnpm dev`). Server auto-seeds demo project from env vars.
3. Run smoke (`bash scripts/validate.sh`).
4. Inspect logs.

## Scripts

| Script | Purpose |
|---|---|
| `bash scripts/validate.sh` | Full delivery gate (lint, typecheck, tests, build, architecture, AC, smoke) |
| `bash scripts/smoke.sh` | Quick smoke: build, start server, hit `/v1/health` |
| `bash scripts/check-architecture.sh` | Verify layering rules |
| `bash scripts/check-ac-coverage.sh` | Verify AC tag coverage in plan |
| `bash scripts/open-pr.sh` | Validate, push, open/update PR |
| `bash scripts/claude-fix-pr.sh <N>` | Render Codex review into repair prompt |

## GitHub Loop

- `.github/workflows/ci.yml` mirrors the local delivery gate on pushes and pull requests.
- `.github/workflows/pr-review.yml` posts or updates a sticky pull request comment with changed files and current check status.
- `.github/workflows/auto-merge.yml` can squash-merge PRs labeled `automerge` once `validate` and `comment` are green, the latest structured Codex review is `READY`, and review threads are resolved. It also retries `UNSTABLE` merge states and sweeps open `automerge` PRs every 5 minutes so transient GitHub merge-state lag does not strand ready PRs.
- `bash scripts/open-pr.sh` standardizes the local branch -> validate -> push -> PR flow and can add `automerge` on request.
- `bash scripts/claude-fix-pr.sh <pr-number>` renders the latest structured Codex review comment into a repair prompt for Claude.

## Codex Review Comment Protocol

- Keep one sticky comment marked `<!-- seekapi-codex-review -->`
- Include `STATUS: READY` when the PR is mergeable
- Include `STATUS: BLOCKED` when Claude still has fixes to make
- List blocking issues with a `BLOCKING:` prefix so Claude can repair them deterministically
- Resolve fixed review threads before posting `STATUS: READY`
- Auto-merge will wait for the latest Codex review status to become `READY` and for all review threads to be resolved

## Key Environment Variables

| Variable | Purpose | Fallback |
|---|---|---|
| `ENCRYPTION_KEY` | Credential encryption at rest | **Required** |
| `BRAVE_API_KEY` | Brave Search BYOK | Searches fail, health shows "unavailable" |
| `TAVILY_API_KEY` | Tavily Search BYOK | Tavily searches fail, health shows "unavailable" |
| `KAGI_API_KEY` | Kagi Search BYOK | Kagi searches fail, health shows "unavailable" |
| `ADMIN_API_KEY` | Enables admin endpoints (`/v1/admin/*`) | Admin routes not registered |
| `DATABASE_URL` | PostgreSQL for durable persistence | In-memory (data lost on restart) |
| `REDIS_URL` | Redis for durable rate limiting | In-memory (graceful degradation if Redis dies) |

## Common Failure Buckets

### Validation Failures (400)

Symptoms: request rejected with 400, missing or malformed fields.

Check:
- Route schema in `src/modules/capabilities/http/routes.ts`
- Canonical request contract in `src/providers/core/types.ts`
- Test coverage for AC labels

### Auth Failures (401/403)

Symptoms: request rejected with 401 or 403.

**Downstream API keys** (for `/v1/search/*`, `/v1/health/providers`):
- `Authorization: Bearer <key>` header present
- API key matches `SEED_API_KEY` (default: `sk_test_seekapi_demo_key_001`) or a key minted via admin API
- Key status is "active" in the repository
- Project status is "active"

**Admin API keys** (for `/v1/admin/*`):
- `Authorization: Bearer <ADMIN_API_KEY>` header present
- Token matches the `ADMIN_API_KEY` environment variable exactly
- 401 = missing/malformed header; 403 = wrong admin key
- Admin routes return 404 if `ADMIN_API_KEY` is not set (routes not registered)

### Provider Failures (502/504)

Symptoms: upstream timeout, provider unavailable, bad upstream credential.

Check:
- `BRAVE_API_KEY` / `TAVILY_API_KEY` / `KAGI_API_KEY` is set and valid
- Provider credential decryption succeeds (`ENCRYPTION_KEY` matches)
- `/v1/health/providers` shows provider status
- Routing fallback classification in `src/modules/routing/service/error-classifier.ts`

Provider capabilities:
| Provider | Capabilities |
|---|---|
| `brave` | `search.web`, `search.news`, `search.images` |
| `tavily` | `search.web` |
| `kagi` | `search.web`, `search.news` |

Default seed routing for `search.web`: Brave (priority 0, default) → Tavily (priority 1, fallback) → Kagi (priority 2, fallback).
Default seed routing for `search.news`: Brave (priority 0, default) → Kagi (priority 1, fallback).

Error categories and their routing behavior:
| Category | Retryable | Fallback? |
|---|---|---|
| `upstream_5xx` | Yes | Falls to next provider |
| `timeout` | Yes | Falls to next provider |
| `rate_limited` | Yes | Falls to next provider |
| `bad_credential` | No | Fails immediately |
| `invalid_request` | No | Fails immediately |

### Rate Limit Failures (429)

Symptoms: repeated 429 responses.

Check:
- Default: 100 requests per 60-second window per project
- `x-ratelimit-remaining` header shows remaining quota
- `x-ratelimit-reset` header shows seconds until window resets
- If Redis is down, rate limiting degrades to open gate (allows all requests)

### Health Probe Issues

Symptoms: `/v1/health/providers` shows unexpected status.

| Status | Meaning | Action |
|---|---|---|
| `healthy` | Probe succeeded with real credential | Normal operation |
| `degraded` | Probe ran but upstream reported issues | Check Brave API status; routing will skip this provider |
| `unavailable` | No credential to probe with | Set `BRAVE_API_KEY`; routing treats as optimistic OK |

Health probes are cached for 30 seconds and bounded to 10 seconds per provider.

### Architecture Check Failures

Symptoms: `scripts/check-architecture.sh` fails.

Check:
- Direct transport-to-repository dependencies
- Service references to HTTP response objects
- Misplaced provider-specific schemas

### Admin API Issues

Symptoms: admin endpoints return unexpected errors.

| Symptom | Likely cause | Fix |
|---|---|---|
| 404 on `/v1/admin/*` | `ADMIN_API_KEY` not set | Set `ADMIN_API_KEY` env var and restart |
| 403 on admin endpoint | Wrong admin key | Verify `ADMIN_API_KEY` matches the Bearer token |
| 400 "provider not supported" | Invalid provider name | Allowed providers: `brave`, `tavily`, `kagi` |
| 400 "capability not supported" | Invalid capability | Only `search.web`, `search.news`, `search.images` are supported |
| 404 "Project not found" | Project ID doesn't exist or is inactive | Create a project first via `POST /v1/admin/projects` |
| Disabled key still works | Key was disabled but previous auth was cached | Keys are looked up per-request; verify the disable call returned 200 |

### Stats & Query Endpoints (Phase 3.5)

| Endpoint | Purpose |
|---|---|
| `GET /v1/admin/stats/dashboard` | Aggregated request stats (total, success, failure, avg latency) |
| `GET /v1/admin/stats/timeseries` | Time series data (`?granularity=hour\|day`) |
| `GET /v1/admin/stats/capabilities` | Per-capability request breakdown |
| `GET /v1/admin/usage` | Paginated usage events (`?page=&pageSize=&capability=&success=`) |
| `GET /v1/admin/projects/:id/keys/stats` | Per-key usage stats for a project |
| `GET /v1/admin/audit` | Paginated audit log (`?action=&projectId=`) |
| `GET /v1/admin/projects/:id/quota` | Project quota config + current usage |
| `PUT /v1/admin/projects/:id/quota` | Create/update quota limits |
| `GET /v1/admin/quotas` | List all project quotas with usage |

### Per-Key Attribution

Each downstream API key carries its own `apiKeyId` through the request lifecycle:

- **Usage events**: `apiKeyId` field identifies which key made the request
- **Audit logs**: `actorId` field (with `actorType: "api_key"`) identifies the key
- **Rate limiting**: Shared per-project (not per-key); all keys on the same project share a counter

To verify attribution, create two keys for the same project, make requests with each, and inspect the usage/audit records. Disabling one key should not affect the other.

## Logging

Structured JSON logs (via Pino) include:
- `reqId` — request identifier
- `usageEvent.projectId` — project tenant
- `usageEvent.capability` — search type
- `usageEvent.provider` — selected provider
- `usageEvent.fallbackCount` — number of fallback attempts
- `auditEntry.action` — security/operational event

Sensitive data (credentials, API keys) is never logged.

## Operator Console (Frontend)

The frontend is a React + Vite app at `frontend/` with Tailwind CSS styling.

| Page | Path | Description |
|---|---|---|
| Overview | `/` | Server health + project list |
| Dashboard | `/dashboard` | Stats cards, time series chart, capability breakdown |
| Projects | `/projects` | CRUD project management |
| Project Detail | `/projects/:id` | Credential, bindings, keys per project |
| API Keys | `/keys` | Per-key usage stats across all projects |
| Usage Records | `/usage` | Filterable, paginated request log |
| Subscriptions | `/subscriptions` | Quota cards with edit modal |
| Flow Runner | `/flow-runner` | 10-step end-to-end Brave workflow test |

### Frontend Scripts

| Command | Purpose |
|---|---|
| `pnpm --dir frontend dev` | Start dev server on port 5173 |
| `pnpm --dir frontend test` | Run Vitest unit tests |
| `pnpm --dir frontend build` | Production build |
| `pnpm --dir frontend run lint` | ESLint check |
| `pnpm --dir frontend run typecheck` | TypeScript check |

# Debugging Guide

## Purpose

This document explains the debugging workflow for SeekAPI.
It covers system startup, data preparation, smoke checks, and common failure points.

## Standard Flow

1. Set required env vars (`ENCRYPTION_KEY`, optionally `BRAVE_API_KEY`).
2. Start the app (`npm run dev`). Server auto-seeds demo project from env vars.
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

Check:
- `Authorization: Bearer <key>` header present
- API key matches `SEED_API_KEY` (default: `sk_test_seekapi_demo_key_001`)
- Key status is "active" in the repository
- Project status is "active"

### Provider Failures (502/504)

Symptoms: upstream timeout, provider unavailable, bad upstream credential.

Check:
- `BRAVE_API_KEY` is set and valid
- Provider credential decryption succeeds (`ENCRYPTION_KEY` matches)
- `/v1/health/providers` shows provider status
- Routing fallback classification in `src/modules/routing/service/error-classifier.ts`

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

## Logging

Structured JSON logs (via Pino) include:
- `reqId` — request identifier
- `usageEvent.projectId` — project tenant
- `usageEvent.capability` — search type
- `usageEvent.provider` — selected provider
- `usageEvent.fallbackCount` — number of fallback attempts
- `auditEntry.action` — security/operational event

Sensitive data (credentials, API keys) is never logged.

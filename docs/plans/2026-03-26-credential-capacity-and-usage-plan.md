# Credential Capacity and Usage Attribution Plan

## Date

2026-03-26

## Goal

Add credential-level usage attribution, capacity policies, and multi-credential selection to SeekAPI. This enables operators to track per-credential usage, set capacity limits, and have the runtime automatically exclude exhausted credentials.

## Acceptance Criteria

### AC1 — credentialId on usage events

Usage events include `credentialId` so every request can be attributed to the specific credential that served it.

- The `usage_events` DB schema gains a nullable `credential_id` column (UUID).
- The `UsageEvent` interface gains an optional `credentialId` field.
- `recordSuccess` and `recordFailure` accept and persist `credentialId`.
- Existing events without `credentialId` remain valid (nullable column).

### AC2 — Credential capacity policy

A new `credential_capacities` table stores per-credential capacity limits.

- Schema: `id`, `credentialId` (FK to provider_credentials), `dailyLimit`, `monthlyLimit`, `createdAt`, `updatedAt`.
- Repository with in-memory and (interface-only for now) Drizzle implementations.
- Service method to check remaining capacity for a credential.

### AC3 — CredentialService returns credentialId

`CredentialService.resolve()` returns `{ credentialId, secret }` instead of just a string, so callers know which credential was used.

### AC4 — credentialId threaded through search → usage flow

The search execution pipeline captures the resolved `credentialId` and passes it to `usageService.recordSuccess/recordFailure`.

### AC5 — Multi-credential candidate selection

When a project has multiple credentials for the same provider (via credential refs), the system selects among non-exhausted candidates.

- `CredentialService` gains `resolveWithCapacity(projectId, provider)` that returns candidates filtered by remaining capacity.
- `SearchService` uses the first available credential.

### AC6 — Runtime exclusion of hard-exhausted credentials

During routing, credentials that have hit their hard capacity limit are excluded from candidate selection. If all credentials for a provider are exhausted, the provider is skipped in the fallback chain.

### AC7 — Admin credential capacity/usage endpoints

- `GET /v1/admin/credentials/:credentialId/capacity` — get capacity config + current usage.
- `PUT /v1/admin/credentials/:credentialId/capacity` — set daily/monthly limits.
- `GET /v1/admin/credentials/:credentialId/usage` — get usage stats for a credential.

### AC8 — Frontend: credential usage on Providers page

The Providers page shows each credential's usage count and remaining capacity (when a capacity policy is set).

## Constraints

- Do not break existing usage event persistence (nullable column).
- Do not log or expose raw provider secrets.
- Service layer must not return HTTP response objects.
- Transport must not access repositories directly.
- Provider adapters must not handle admin/control-plane logic.
- Credential capacity checks happen in the service layer, not in routing or transport.

## Non-Goals

- Real-time streaming capacity updates via WebSocket.
- Automatic credential rotation on exhaustion.
- Billing integration.
- Credential capacity alerts or notifications.

## Task Order

1. AC1 — Add `credentialId` to `UsageEvent` interface and `usage_events` schema.
2. AC3 — Update `CredentialService.resolve()` to return `{ credentialId, secret }`.
3. AC4 — Thread `credentialId` through `SearchService` → capability routes → `UsageService`.
4. AC2 — Create credential capacity schema, repository, and service methods.
5. AC5 — Multi-credential candidate selection in `CredentialService`.
6. AC6 — Exhausted-credential exclusion in search execution.
7. AC7 — Admin endpoints for credential capacity and usage.
8. AC8 — Frontend credential usage display.

## Validation

```bash
bash scripts/validate.sh
```

# Credential Capacity and Usage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add upstream credential-level capacity tracking, usage observability, and selection guardrails so operators can see which provider credentials are nearing exhaustion and the runtime can stop routing traffic to hard-exhausted credentials.

**Architecture:** The current system records usage at the `project`, `apiKey`, and `provider` layers, but it does not record which upstream credential actually served a request. This plan promotes credential usage to a first-class control-plane dimension by persisting `credentialId` on usage events, adding credential quota/config entities, exposing admin reporting endpoints, and changing credential resolution from "single credential string" to "selected credential descriptor". The runtime remains a modular monolith: transport validates and delegates, service layer orchestrates, repositories own persistence, and provider adapters remain unaware of admin concerns.

**Tech Stack:** TypeScript, Fastify, PostgreSQL, Drizzle ORM, React, Vite, Vitest

## Problem Statement

Today SeekAPI can answer:

- which project is using traffic
- which downstream API key is using traffic
- which provider handled traffic

But it cannot answer:

- which upstream credential actually served the request
- how close a specific credential is to its configured daily or monthly ceiling
- which credential should be drained, disabled, or avoided for routing
- whether multiple credentials for one provider can be distributed safely

This is not only a frontend visibility gap. It is also a runtime modeling gap:

- `usage_events` does not persist `credentialId`
- `CredentialService.resolve()` returns only a plaintext string, not a selected credential identity
- `CredentialRepository.findByProjectAndProvider()` resolves only one active credential for a project/provider pair
- the operator console has no credential-level usage or remaining-capacity surface

## Acceptance Criteria

AC1: Request accounting persists the upstream credential identity used for each request.

- `usage_events` stores `credentialId`
- success and failure events both record `credentialId`
- integration tests prove the recorded credential matches the selected upstream credential

AC2: Control-plane configuration exists for credential-level capacity and status.

- a repository-backed credential capacity model exists
- operators can configure per-credential limits and control state without exposing raw secrets
- the model supports at least:
  - `maxRequestsPerMinute`
  - `dailyRequestLimit`
  - `monthlyRequestLimit`
  - `softDisableThresholdPct`
  - `selectionMode`
  - `status`

AC3: Runtime credential selection can choose among multiple eligible credentials for the same provider.

- selection remains deterministic and explainable
- hard-exhausted or disabled credentials are never selected
- the selected credential identity is returned to the caller of the selection layer
- provider adapters still receive only plaintext credential material plus request context

AC4: Admin HTTP endpoints expose credential-level usage and remaining-capacity reporting.

- operators can list credential usage summaries
- operators can inspect a single credential's recent usage and limit status
- operators can inspect project-to-credential references and capacity state together
- responses expose no raw provider secret material

AC5: The operator console shows credential-level usage and capacity on the Providers page.

- each global credential row shows usage summary and remaining-capacity indicators
- operators can identify credentials at risk of exhaustion
- operators can see whether a credential is selectable, throttled, or exhausted

AC6: Routing can exclude a hard-exhausted credential for provider execution without rewriting canonical contracts.

- the capability routes stay unchanged
- provider adapters stay unchanged except for receiving the selected plaintext credential
- explicit provider selection still works
- health-aware provider fallback remains intact

AC7: `bash scripts/validate.sh` remains the delivery gate and passes with new targeted tests for credential-level persistence, selection, admin routes, and frontend UI.

## Constraints

- Preserve service/repository/transport layering from `docs/architecture.md`.
- Do not expose raw provider secrets through admin APIs or frontend state after submission.
- Do not leak provider-specific quota fields into canonical search request or response contracts.
- Keep provider adapters focused on provider HTTP logic only.
- Preserve deterministic routing behavior.
- Keep the operator console as an internal control-plane surface only.
- Use `pnpm`, not `npm`.
- Use TDD task sequencing for each implementation slice.

## Non-Goals

- Direct provider balance API integrations in this plan
- Automatic cost optimization across providers
- Probabilistic or heuristic routing
- Multi-provider race execution
- Billing or invoicing
- Tenant-facing self-serve quota dashboards
- Historical backfill of exact `credentialId` for already-recorded legacy usage rows

## Design Notes

### Why this plan includes runtime selection, not only reporting

If we only add credential-level dashboards but keep `CredentialRepository.findByProjectAndProvider()` returning a single credential row, operators would see risk but SeekAPI still could not shift traffic across multiple credentials for the same provider. That would leave the "switch or load balance when one credential is nearly empty" problem unresolved. This plan therefore includes both:

- observability and admin reporting
- a deterministic credential selection layer

### Recommended selection policy for MVP

Use a simple deterministic policy first:

- eligible set = active, referenced, not hard-exhausted credentials for the provider
- order by:
  1. lowest utilization ratio
  2. lowest recent RPM load
  3. stable tie-breaker by credential id

This achieves predictable spreading without introducing opaque heuristics.

### Recommended data model split

Keep metadata and limits separate:

- credential metadata remains in `provider_credentials`
- project linkage remains in `project_credential_refs`
- new capacity/config lives in a dedicated table such as `credential_capacity_policies`
- usage events persist the selected `credentialId`

This avoids overloading the encrypted credential table with mutable operational counters.

## Validation Commands

Every task must continue to pass:

```bash
bash scripts/validate.sh
```

Targeted commands during implementation:

```bash
pnpm test -- --run tests/credentials/credential-selection.test.ts
pnpm test -- --run tests/admin/credential-capacity-routes.test.ts
pnpm test -- --run tests/e2e/credential-attribution.test.ts
pnpm --dir frontend test --run src/__tests__/providers.test.tsx
```

---

### Task 1: Add the active plan and architecture notes

**Files:**
- Create: `docs/plans/2026-03-26-credential-capacity-and-usage-plan.md`
- Modify: `docs/debugging.md`
- Modify: `docs/architecture.md` only if implementation introduces a new durable operational repository concept that needs explicit boundary wording

**Step 1: Write documentation-only failing expectations**

Document the missing capability in `docs/debugging.md`:

- current system tracks provider usage, not credential usage
- credential-level balancing is not yet available

**Step 2: Save this plan as the active execution document**

No code yet. This step exists so harness work stays inside an explicit plan.

**Step 3: Update debugging notes after implementation**

Add operator verification steps for:

- credential usage summary
- credential exhaustion status
- routing exclusion of exhausted credentials

**Step 4: Commit**

```bash
git add docs/plans/2026-03-26-credential-capacity-and-usage-plan.md docs/debugging.md
git commit -m "docs: plan credential capacity and usage tracking"
```

---

### Task 2: Extend persistence with credential-level capacity config and attribution

**Files:**
- Modify: `src/infra/db/schema/usage-events.ts`
- Create: `src/infra/db/schema/credential-capacity-policies.ts`
- Modify: `src/infra/db/schema/index.ts`
- Modify: `src/infra/db/repositories/usage-event-repository.ts`
- Create: `src/infra/db/repositories/credential-capacity-repository.ts`
- Modify: `src/infra/db/repositories/index.ts`
- Test: `tests/repositories/credential-capacity-repository.test.ts`
- Test: `tests/repositories/usage-event-credential-attribution.test.ts`

**Step 1: Write failing repository tests**

Cover:

- saving and loading a credential capacity policy
- listing policies by provider
- querying usage events grouped by `credentialId`
- aggregating credential stats from persisted usage events

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- --run tests/repositories/credential-capacity-repository.test.ts tests/repositories/usage-event-credential-attribution.test.ts
```

Expected:

- schema or repository symbols missing
- usage repository does not yet aggregate by `credentialId`

**Step 3: Add schema and repository types**

Implement:

- new `credential_capacity_policies` table keyed by `credentialId`
- `usage_events.credentialId`
- in-memory and Drizzle repository implementations

Required repository shape:

- `findByCredentialId(credentialId)`
- `upsert(policy)`
- `listAll()`
- `listByProvider(provider)`
- `credentialStats(filters?)`

**Step 4: Extend usage-event aggregation**

Add credential-level summary interfaces, for example:

- `CredentialUsageStats`
- `CredentialUsageFilters`

Each summary should include:

- `credentialId`
- `provider`
- `requestCount`
- `successCount`
- `failureCount`
- `avgLatencyMs`
- `lastUsedAt`

**Step 5: Run tests to verify pass**

Run the repository tests again and expect PASS.

**Step 6: Commit**

```bash
git add src/infra/db/schema src/infra/db/repositories tests/repositories
git commit -m "feat: add credential capacity persistence and usage attribution"
```

---

### Task 3: Introduce credential selection as a service-layer concern

**Files:**
- Modify: `src/infra/db/repositories/credential-repository.ts`
- Modify: `src/modules/credentials/service/credential-service.ts`
- Create: `src/modules/credentials/service/credential-selector.ts`
- Modify: `src/app/build-app.ts`
- Test: `tests/credentials/credential-selection.test.ts`
- Test: `tests/e2e/credential-attribution.test.ts`

**Step 1: Write failing tests for multi-credential selection**

Cover:

- one provider with multiple active credentials
- disabled credential excluded
- hard-exhausted credential excluded
- deterministic tie-break ordering
- selected `credentialId` returned together with decrypted secret

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- --run tests/credentials/credential-selection.test.ts
```

Expected:

- `CredentialService.resolve()` cannot return identity + secret
- repository can only resolve one credential row

**Step 3: Change repository and service contracts**

Evolve credential lookup from:

- `findByProjectAndProvider(projectId, provider) -> CredentialRow | undefined`

to a candidate-oriented model:

- `findCandidatesByProjectAndProvider(projectId, provider) -> CredentialRow[]`

Evolve credential resolution from:

- plaintext secret only

to:

- `ResolvedCredential { credentialId, provider, plaintextSecret, selectionReason }`

**Step 4: Add deterministic selector**

Implement a selector that receives:

- credential candidates
- capacity policies
- recent usage summaries

and returns one selected credential.

MVP selection rules:

1. filter to active credentials
2. filter out `status != active`
3. filter out hard-exhausted credentials
4. sort by lowest utilization ratio
5. tie-break by lower recent request count
6. final tie-break by `credentialId`

**Step 5: Wire selection into the runtime**

Update `buildApp()` and `SearchService` dependencies so provider execution still receives plaintext secret, but usage recording can also receive `credentialId`.

**Step 6: Run tests to verify pass**

Run:

```bash
pnpm test -- --run tests/credentials/credential-selection.test.ts tests/e2e/credential-attribution.test.ts
```

Expected:

- credential selection is deterministic
- selected `credentialId` reaches usage persistence

**Step 7: Commit**

```bash
git add src/modules/credentials src/infra/db/repositories/credential-repository.ts src/app/build-app.ts tests/credentials tests/e2e
git commit -m "feat: add credential selection service"
```

---

### Task 4: Record credential identity on every usage event

**Files:**
- Modify: `src/modules/usage/service/usage-service.ts`
- Modify: `src/modules/capabilities/service/search-service.ts`
- Modify: `tests/e2e/multi-provider-wiring.test.ts`
- Modify: `tests/per-key/per-key-control.test.ts`
- Test: `tests/e2e/credential-attribution.test.ts`

**Step 1: Write failing usage-attribution test**

Cover both:

- success path records `credentialId`
- failure path records `credentialId` when the chosen credential fails upstream

**Step 2: Run test to verify failure**

Run:

```bash
pnpm test -- --run tests/e2e/credential-attribution.test.ts
```

Expected:

- usage events missing `credentialId`

**Step 3: Update service contracts**

Extend `UsageEvent`, `recordSuccess`, and `recordFailure` to require:

- `credentialId`

Update the search execution flow so the selected credential descriptor is preserved through provider execution and usage/audit recording.

**Step 4: Run tests to verify pass**

Run the targeted tests and expect PASS.

**Step 5: Commit**

```bash
git add src/modules/usage src/modules/capabilities tests/e2e tests/per-key
git commit -m "feat: attribute usage events to upstream credentials"
```

---

### Task 5: Add admin endpoints for credential capacity and usage

**Files:**
- Modify: `src/modules/admin/service/admin-service.ts`
- Modify: `src/modules/admin/http/routes.ts`
- Modify: `src/app/bootstrap.ts`
- Modify: `src/app/build-app.ts`
- Test: `tests/admin/credential-capacity-routes.test.ts`

**Step 1: Write failing route tests**

Add admin route coverage for:

- `GET /v1/admin/credentials/capacity`
- `GET /v1/admin/credentials/:credentialId/capacity`
- `PUT /v1/admin/credentials/:credentialId/capacity`
- `GET /v1/admin/credentials/:credentialId/usage`

Response shape must include:

- credential metadata
- policy config
- current daily/monthly usage
- remaining capacity
- exhaustion state
- recent request summary

**Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- --run tests/admin/credential-capacity-routes.test.ts
```

Expected:

- route or service methods missing

**Step 3: Implement service-layer aggregation**

Keep all composition inside `AdminService`.

Add methods like:

- `listCredentialCapacity()`
- `getCredentialCapacity(credentialId)`
- `upsertCredentialCapacity(credentialId, updates)`
- `getCredentialUsage(credentialId, filters)`

Do not read repositories directly from transport handlers.

**Step 4: Add route validation and error mapping**

Map:

- missing credential -> 404
- invalid negative limits -> 422
- disabled credential updates -> still allowed unless product rules say otherwise

**Step 5: Run tests to verify pass**

Run targeted route tests and expect PASS.

**Step 6: Commit**

```bash
git add src/modules/admin src/app tests/admin
git commit -m "feat: add admin credential capacity and usage endpoints"
```

---

### Task 6: Surface credential usage and remaining capacity in the operator console

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/routes/providers/ProvidersPage.tsx`
- Modify: `frontend/src/i18n/en.json`
- Modify: `frontend/src/i18n/zh.json`
- Test: `frontend/src/__tests__/providers.test.tsx`

**Step 1: Write failing frontend tests**

Cover:

- provider credential rows show usage summary
- high-utilization credential shows warning state
- exhausted credential shows blocked state
- edit flow for credential capacity settings

**Step 2: Run test to verify failure**

Run:

```bash
pnpm --dir frontend test --run src/__tests__/providers.test.tsx
```

Expected:

- missing API methods
- missing UI fields

**Step 3: Extend admin API client**

Add methods for:

- listing credential capacity summaries
- loading single credential usage
- updating credential policy

**Step 4: Upgrade Providers page**

For each credential row show:

- provider
- name
- status
- request count
- last used
- daily usage / daily limit
- monthly usage / monthly limit
- remaining percentage
- selection state badge: `active`, `warning`, `exhausted`, `disabled`

Keep secrets hidden.

**Step 5: Run tests to verify pass**

Run targeted frontend tests and expect PASS.

**Step 6: Commit**

```bash
git add frontend/src/lib frontend/src/routes/providers frontend/src/i18n frontend/src/__tests__/providers.test.tsx
git commit -m "feat: show credential capacity and usage in providers console"
```

---

### Task 7: Add routing exclusion for hard-exhausted credentials

**Files:**
- Modify: `src/modules/credentials/service/credential-selector.ts`
- Modify: `src/modules/routing/service/routing-service.ts` only if additional explicit credential-level result metadata is needed
- Test: `tests/credentials/credential-selection.test.ts`
- Test: `tests/e2e/credential-attribution.test.ts`

**Step 1: Write failing guardrail tests**

Cover:

- provider remains usable when one credential is exhausted and another is active
- request fails with a clear error when all credentials for the chosen provider are exhausted
- explicit provider routing still respects credential exhaustion guardrails

**Step 2: Run tests to verify failure**

Run the targeted credential selection and e2e tests and expect FAIL.

**Step 3: Implement minimal guardrail**

Do not change canonical API behavior.

Implement:

- hard-exhausted credentials excluded from selection
- if no eligible credential remains for a provider, bubble a typed error that remains provider-local
- provider-level fallback can then move to the next provider when the error is retryable by policy

**Step 4: Run tests to verify pass**

Run:

```bash
pnpm test -- --run tests/credentials/credential-selection.test.ts tests/e2e/credential-attribution.test.ts tests/routing/multi-provider-routing.test.ts
```

Expected:

- eligible credentials selected
- exhausted credentials excluded

**Step 5: Commit**

```bash
git add src/modules/credentials src/modules/routing tests/credentials tests/e2e tests/routing
git commit -m "feat: exclude exhausted credentials from provider selection"
```

---

### Task 8: Final docs, migration notes, and delivery gate

**Files:**
- Modify: `docs/debugging.md`
- Modify: `README.md` only if operator workflow references should surface credential capacity
- Modify: `scripts/validate.sh` only if a new targeted test command must be included

**Step 1: Document operator workflow**

Add:

- how to configure credential limits
- how to read exhausted vs warning state
- how to verify routing moved off an exhausted credential

**Step 2: Run the full delivery gate**

Run:

```bash
bash scripts/validate.sh
```

Expected:

- all checks pass

**Step 3: Record validation evidence**

Capture:

- targeted repository tests
- targeted route tests
- targeted frontend tests
- full validate script

**Step 4: Commit**

```bash
git add docs README.md scripts/validate.sh
git commit -m "docs: finalize credential capacity rollout notes"
```

---

## Implementation Notes for Claude

- Do not start implementation outside this plan.
- Prefer extending existing repository and admin patterns rather than introducing parallel abstractions.
- Keep provider adapters unchanged except for consuming plaintext credential input as they already do.
- If a migration is needed for `usage_events.credentialId`, write it before repository changes that rely on the new column.
- If schema rollout requires a backward-compatible step, make `credentialId` nullable first, then tighten only after all writers are updated.
- Add focused tests before each implementation slice.
- Use frequent commits exactly as listed above unless a step must be combined for schema consistency.

## Suggested Rollout Order

1. Persistence and repository types
2. Credential selector service
3. Usage attribution
4. Admin routes
5. Providers UI
6. Exhaustion guardrails
7. Docs and validate

## Risks and Mitigations

- Risk: Credential selection changes runtime semantics.
  Mitigation: keep MVP selection deterministic and fully unit-tested.

- Risk: Legacy usage rows will lack `credentialId`.
  Mitigation: support nullable historical rows and make UI label them as `unknown` until enough fresh traffic exists.

- Risk: Capacity values may drift from real provider balances.
  Mitigation: treat this plan as operator-configured internal accounting, not provider-authoritative balance sync.

- Risk: Multiple credentials for one provider may have different hidden provider-side limits.
  Mitigation: keep per-credential policy explicit and operator-controlled.

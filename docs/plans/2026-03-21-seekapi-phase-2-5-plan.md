# SeekAPI Phase 2.5 Plan

**Date:** 2026-03-21

**Status:** Draft

**Goal:** Close the Brave-only control-plane gap so SeekAPI can mint and manage downstream keys for multiple users while routing them through one managed Brave upstream credential path.

**Context:** Phase 2 proved the Brave execution path, observability persistence, health behavior, and local operator workflow. It did not fully finish the product loop for a Brave-only service distributor because project records, downstream API keys, provider credentials, and routing policy are still primarily seeded or in-memory in the runtime bootstrap path. Before Phase 3 adds another provider, SeekAPI should first become a real Brave key distributor and manager.

## Product Focus

Phase 2.5 is not about adding another provider.
Phase 2.5 is about making the existing Brave-only product flow actually operable for real tenants:

- one platform-managed Brave credential path
- many downstream SeekAPI keys
- per-project and per-key control
- persistent policy instead of seed-only configuration

This is the point where SeekAPI stops being "Brave path implemented" and becomes "Brave path distributable as a service".

## Acceptance Criteria

AC1: Downstream API keys, projects, Brave provider credentials, and provider bindings all have real Drizzle-backed repository implementations and can be loaded at runtime when `DATABASE_URL` is set.

AC2: The server runtime uses DB-backed implementations for auth, project resolution, credential lookup, and routing policy when `DATABASE_URL` is present, instead of depending on seed-only in-memory bootstrap for normal operation.

AC3: An authenticated admin control surface can create projects, mint downstream API keys, attach or rotate Brave credentials, and configure Brave capability bindings without direct database edits.

AC4: Per-project and per-key request control is enforceable and observable, including allow/deny state, rate limiting, and usage/audit attribution.

AC5: Local and operator documentation show how to stand up a Brave-backed service distributor end-to-end: create a project, attach a Brave key, mint downstream keys, and validate that separate downstream keys are independently attributable.

AC6: The downstream product model is explicit: clients authenticate with SeekAPI keys, not provider-native keys, and multiple providers later remain hidden behind the same downstream auth surface.

## Constraints

- Keep Brave as the only fully implemented upstream provider in this phase.
- Do not add a UI.
- Do not add billing or quotas by money.
- Use a simple operator auth model for the admin surface in this phase: `ADMIN_API_KEY` from environment, not role-based auth redesign.
- Do not leak raw provider secrets in logs, responses, or admin reads.
- Keep canonical search routes unchanged.
- Preserve the existing transport/service/repository/provider boundaries.
- When `DATABASE_URL` is not set, the existing seed-based in-memory bootstrap must continue to work unchanged for tests, smoke, and fast local setup.
- Keep `bash scripts/validate.sh` as the delivery gate.

## Non-Goals

- Adding Tavily, Kagi, SerpAPI, Perplexity, or Firecrawl
- Provider passthrough keys for end users
- User-facing dashboard
- Billing, invoicing, or subscription plans
- New canonical capabilities such as `search.answer` or `search.extract`
- Complex multi-provider routing or cost optimization

## Product Model

### Downstream Auth Model

SeekAPI should expose one downstream auth surface.
Clients receive SeekAPI-issued API keys, not provider-native Brave keys.

That means:

- one user or integration may receive one or more SeekAPI keys
- each key maps to a project or sub-scope owned by SeekAPI
- the project determines which provider credential and routing policy apply
- later, when multiple providers exist, the same SeekAPI key model still applies

The default future-facing rule should be:

- **one SeekAPI key per consumer or integration scope**
- **not one downstream key per provider**

Provider choice belongs to project policy, not to the downstream auth contract.

## Recommended Entity Model

- `Project`
  tenant boundary and main policy container
- `ApiKey`
  downstream credential issued by SeekAPI
- `ProviderCredential`
  encrypted Brave upstream secret attached to a project
- `ProviderBinding`
  capability-scoped allow/deny and priority policy for Brave
- `RoutingPolicy`
  project default provider and fallback order

Optional later extension:

- `ApiKeyPolicy`
  per-key capability restrictions or status overrides

Phase 2.5 should at minimum make `Project`, `ApiKey`, `ProviderCredential`, and `ProviderBinding` persistent and operable.

## Validation Commands

Every task in this phase must continue to pass:

```bash
bash scripts/validate.sh
```

Phase-specific validation should also include:

- one manual admin bootstrap flow
- one manual Brave search flow with a newly minted downstream key
- one attribution check proving two downstream keys can be distinguished in usage and audit records

## Task 22: Implement Drizzle repositories and DB-backed runtime wiring for control-plane entities

**Files:**
- Modify: `src/infra/db/repositories/api-key-repository.ts`
- Modify: `src/infra/db/repositories/project-repository.ts`
- Modify: `src/infra/db/repositories/credential-repository.ts`
- Modify or create: repository files for provider bindings / routing policy
- Modify: `src/app/build-app.ts`
- Modify: `src/app/server.ts`
- Modify: service files under `src/modules/auth/service/*`
- Modify: service files under `src/modules/projects/service/*`
- Modify: service files under `src/modules/credentials/service/*`
- Test: repository-backed tests under `tests/repositories/*`
- Test: integration tests for DB-backed runtime wiring

**Goal:** Make the control-plane entities real persisted records and ensure the actual app runtime uses them whenever `DATABASE_URL` is configured.

**Expected outcomes:**

- API keys can be loaded from PostgreSQL
- projects and provider bindings can be loaded from PostgreSQL
- Brave credentials can be loaded from PostgreSQL
- `pnpm run db:migrate` successfully creates the required control-plane tables
- auth uses DB-backed API keys when `DATABASE_URL` is set
- project context uses DB-backed projects and bindings when `DATABASE_URL` is set
- Brave credential resolution uses DB-backed credentials when `DATABASE_URL` is set
- repository-backed tests prove parity with existing in-memory behavior
- health probe strategy can use a persisted project, not only seed assumptions

## Task 23: Add admin API for project, key, and credential management

**Files:**
- Create or modify: `src/modules/admin/http/*`
- Create or modify: `src/modules/admin/service/*`
- Modify: `src/app/build-app.ts`
- Test: admin route tests and end-to-end flows

**Goal:** Allow operators to manage the Brave-only distributor without direct database edits.

**Expected outcomes:**

- admin endpoints are protected by `ADMIN_API_KEY`
- create project endpoint
- create / disable downstream API key endpoint
- attach / rotate Brave credential endpoint
- configure Brave capability binding endpoint

## Task 24: Add per-key control and attribution checks

**Files:**
- Modify: auth, usage, and audit service files as needed
- Modify: repository files if per-key status/policy fields are needed
- Test: attribution and key-specific control tests

**Goal:** Prove that different downstream keys can be independently controlled and observed even when they share one Brave upstream path.

**Expected outcomes:**

- disabled key is rejected without affecting sibling keys
- usage events retain key and project attribution
- audit logs retain key and project attribution
- rate limiting remains deterministic at the intended boundary

## Task 25: Finalize Brave-only operator bootstrap as a product workflow

**Files:**
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `docs/plans/2026-03-20-local-dev-checklist.md`
- Create if needed: example admin bootstrap scripts or curl snippets

**Goal:** Document the actual Brave-only product flow end-to-end.

**Expected outcomes:**

- operator can create a project
- operator can attach one Brave key
- operator can mint multiple downstream SeekAPI keys
- operator can verify separate users/integrations are individually attributable and controllable

## Exit Condition

Phase 2.5 is complete only when SeekAPI can act as a real Brave-only key distributor and manager:

- Brave credential stored once per project
- downstream SeekAPI keys issued independently
- requests attributable and controllable per key / project
- no direct DB editing required for normal operator setup

## Next Stage

Only after Phase 2.5 should Phase 3 begin.
At that point the multi-provider expansion will be validating a real service-control plane, not just a clean adapter abstraction.

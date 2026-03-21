# SeekAPI Phase 2 Plan

**Date:** 2026-03-21

**Status:** Draft

**Goal:** Turn the current MVP into a production-ready Brave Search path by replacing remaining demo behavior in the hot path, persisting core operational records, and tightening operator workflows without expanding provider scope.

**Context:** Phase 1 completed the harness, canonical endpoints, Brave adapter wiring, auth, routing scaffolding, health, rate limits, and local/CI validation. Phase 2 should go deeper on one upstream path instead of widening to more providers.

## Product Focus

This phase is not about adding more providers.
This phase is about making Brave Search the complete and reliable first-class path behind SeekAPI's canonical API.

## Acceptance Criteria

AC1: The request hot path no longer depends on demo-only in-memory project, API key, and provider credential wiring for normal Brave execution.

AC2: Project configuration, provider credential binding, and routing policy are resolved through repository-backed services with the same architecture boundaries already defined in `docs/architecture.md`.

AC3: Usage events, audit logs, and provider health snapshots are persisted as real records instead of existing only as in-process hooks or log side effects.

AC4: Rate limiting and provider health behavior are operationally trustworthy for the Brave path, including cache behavior, degradation, and failure handling.

AC5: The local operator path for Brave is fully documented and reproducible, including environment setup, project/bootstrap flow, validation commands, and manual smoke checks.

AC6: The canonical contract for `/v1/search/web`, `/v1/search/news`, and `/v1/search/images` remains stable and provider-neutral while Brave execution quality improves underneath it.

## Constraints

- Keep Brave as the only fully implemented upstream provider in this phase.
- Do not add an admin UI.
- Do not add billing.
- Do not introduce provider-specific top-level fields into canonical request or response contracts.
- Do not bypass service boundaries to "speed up" persistence integration.
- Keep `bash scripts/validate.sh` as the delivery gate.

## Non-Goals

- Adding Tavily, Kagi, SerpAPI, Perplexity, or Firecrawl in this phase
- Provider passthrough API
- `search.answer`, `search.extract`, or `search.serp` delivery
- Dynamic cost-aware routing
- Multi-provider parallel racing
- User-facing dashboards

## Validation Commands

At minimum, every task in this phase must continue to pass:

```bash
bash scripts/validate.sh
```

Additional task-specific validation should include targeted `vitest` runs and one manual Brave-path smoke check where applicable.

## Task 12: Replace demo auth and credential wiring with repository-backed flows

**Files:**
- Modify: `src/modules/auth/service/*`
- Modify: `src/modules/projects/service/*`
- Modify: `src/modules/credentials/service/*`
- Create or modify: repository files under `src/infra/db/`
- Create: tests for repository-backed auth and credential resolution

**Goal:** Remove demo-only hot-path assumptions such as fixed project ids or in-memory key tables from normal request execution.

**Expected outcomes:**

- downstream API keys resolve through repository-backed services
- project context comes from persisted state
- provider credential lookup for Brave is repository-backed and encrypted-at-rest aware

## Task 13: Persist routing policy and Brave provider bindings

**Files:**
- Modify: `src/modules/routing/service/*`
- Modify: `src/modules/projects/service/*`
- Create or modify: repository files for provider bindings and routing policies
- Create: tests for repository-backed default provider and fallback behavior

**Goal:** Make provider enablement, default provider choice, and fallback ordering come from project-scoped persisted policy rather than demo assumptions.

**Expected outcomes:**

- explicit provider rules remain deterministic
- default provider resolution is persisted
- fallback order is project-configurable and testable

## Task 14: Persist usage events, audit logs, and provider health snapshots

**Files:**
- Modify: `src/modules/usage/service/*`
- Modify: `src/modules/audit/service/*`
- Modify: `src/modules/health/service/*`
- Create or modify: repository files for usage, audit, and health snapshot persistence
- Create: tests for durable event recording on success and failure paths

**Goal:** Move observability-critical records from process-local behavior to repository-backed records that reflect real runtime behavior.

**Expected outcomes:**

- successful Brave requests persist usage events
- auth and policy events persist audit logs where appropriate
- provider health results can be cached and stored as snapshots

## Task 15: Harden Brave operational behavior

**Files:**
- Modify: `src/modules/auth/service/rate-limit-service.ts`
- Modify: `src/modules/health/service/*`
- Modify: `src/providers/brave/*`
- Create or modify: tests for degraded upstream, cache behavior, and retry/fallback interactions

**Goal:** Make Brave execution and operational state reliable under degraded upstream conditions.

**Expected outcomes:**

- rate limit behavior is stable with Redis and graceful when Redis is unavailable
- Brave health probe behavior is bounded, cached, and does not create accidental quota burn
- provider failure classification remains deterministic for routing and observability

## Task 16: Finalize Brave operator workflow and runbook

**Files:**
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `docs/plans/2026-03-20-local-dev-checklist.md`
- Create if needed: examples or scripts for bootstrap/manual verification

**Goal:** Ensure an operator can stand up the Brave path locally and verify it without reading code.

**Expected outcomes:**

- local bootstrap flow is explicit
- required environment variables and bootstrap order are documented
- manual Brave smoke checks are documented and reproducible
- docs match the actual runnable system

## Delivery Notes

- Each task should map ACs to tests before implementation starts.
- Each task should be landed through the existing PR loop.
- Phase 2 is complete only when the Brave path is repository-backed, observable, and operable without relying on demo-only hot-path shortcuts.

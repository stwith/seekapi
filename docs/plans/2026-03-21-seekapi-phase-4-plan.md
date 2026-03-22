# SeekAPI Phase 4 Plan

**Date:** 2026-03-21

**Status:** Draft

**Goal:** Prove SeekAPI as a true multi-provider API dispatcher by adding a second search provider without changing the downstream canonical API or weakening the project-scoped control model.

**Context:** Phase 2.5 finished the Brave-only control plane, and the new Phase 3 adds an operator console on top of that flow. Phase 4 starts only after the Brave path is repository-backed, observable, operator-usable, and stable. The primary purpose of Phase 4 is to validate the architecture through a second provider, not to widen capability surface first.

## Primary Direction

Phase 4 is a horizontal expansion phase.

The product question it answers is:

Can SeekAPI route one stable canonical search API across multiple upstream providers while preserving project isolation, policy control, observability, and deterministic behavior?

## Acceptance Criteria

AC1: A second search provider can be configured and executed through the existing canonical endpoints without downstream contract changes.

AC2: Provider enablement, credential resolution, routing policy, and health behavior work for both Brave and the new provider through the same service boundaries.

AC3: Usage, audit, and metrics records retain provider and project dimensions across both providers.

AC4: Deterministic routing and fallback can choose between Brave and the new provider according to persisted project policy.

AC5: Adding the new provider does not require canonical-route-specific branching outside provider adapters, routing services, or repository-backed policy resolution.

AC6: Local verification instructions show how to exercise both providers through the same downstream API shape.

## Constraints

- Do not add a new canonical capability in this phase unless required for provider parity.
- Do not leak provider-specific knobs into canonical top-level fields.
- Keep Brave as a first-class supported provider while adding the second provider.
- Preserve `bash scripts/validate.sh` as the delivery gate.
- Keep the execution flow deterministic and explainable.

## Phase 4B: Third Provider Expansion (Kagi)

**Status:** In Progress

**Goal:** Extend Phase 4 to validate that the multi-provider architecture scales beyond two providers by adding Kagi as a third search provider with full error-envelope handling, routing, and fallback support.

**Rationale:** The original non-goal of "three or more providers in one phase" is relaxed because Phase 4A (Tavily) proved the architecture is stable and extensible. Adding a third provider in 4B validates that the abstraction holds at N>2 with minimal incremental effort.

**Scope:**
- Kagi provider adapter (schemas, client with error-envelope handling, mapper, adapter)
- Provider registry and routing integration for three-provider fallback chains
- Tests covering Kagi-specific error envelopes (200 body with `error[]`)
- Updated documentation for Kagi env vars and capability matrix

## Non-Goals

- Multi-provider racing
- Cost optimization routing
- Further operator console changes beyond what Phase 3 already delivers
- Billing
- Provider passthrough API
- New non-search product surfaces

## Recommended Provider Selection

Choose the second provider based on how well it fits the existing canonical search model.

Preferred candidates:

1. Tavily
2. Kagi
3. SerpAPI

The best choice is the provider that requires the least distortion of canonical `search.web`, `search.news`, and `search.images`.

## Validation Commands

Every task in this phase must continue to pass:

```bash
bash scripts/validate.sh
```

Each provider-specific task should also include targeted adapter and end-to-end tests.

## Candidate Task Breakdown

### Task 32: Select and model the second provider

- choose the second provider
- define credential, capability, and health assumptions
- document any canonical mapping tension before coding

### Task 33: Implement the second provider adapter

- add request mapping
- add response mapping
- add typed provider error handling
- add health probe behavior

### Task 34: Extend repository-backed provider policy

- persist project-level provider enablement for the new provider
- persist fallback ordering across at least two providers
- validate health-aware selection and deterministic fallback

### Task 35: Extend end-to-end routing and observability

- prove canonical routes can hit both providers
- prove usage, audit, and metrics remain correct across provider choice
- prove health and fallback semantics are still operator-visible

### Task 36: Update operator workflow for multi-provider local verification

- document local env setup for both providers
- document manual verification for each provider
- update smoke and examples if required

## Backup Direction

If Phase 4 is intentionally deferred, the backup direction is vertical capability expansion.

That backup means:

- define one new canonical capability
- implement it on one provider first, likely Brave
- expand other providers only after the shared contract is stable

This backup path exists to widen product value without weakening the architectural rule that canonical capability design comes before provider-specific special cases.

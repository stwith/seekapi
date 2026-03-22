# SeekAPI Phase 4 Plan

**Date:** 2026-03-21

**Status:** Draft

**Goal:** Expand SeekAPI from a Brave-only gateway to a true multi-provider search dispatcher by adding Tavily, Kagi, and SerpAPI through the existing canonical API and control-plane boundaries.

**Context:** Phase 2.5 finished the Brave-only control plane, Phase 3 added an operator console, Phase 4A validated the second-provider path with Tavily, and Phase 4B extended the same architecture to Kagi. This document is the single authoritative Phase 4 plan and now captures the remaining detailed execution path for multi-provider expansion without introducing a second competing plan file.

## Primary Direction

Phase 4 is a horizontal expansion phase.

The product question it answers is:

Can SeekAPI route one stable canonical search API across multiple upstream providers while preserving project isolation, policy control, observability, deterministic behavior, and operator usability?

## Acceptance Criteria

AC1: Each additional provider adapter implements `ProviderAdapter`, stays inside `src/providers/<name>/`, and can be executed through the existing canonical endpoints without downstream contract changes.

AC2: Routing, fallback, explicit provider selection, and health-aware exclusion work deterministically across all registered providers through the existing routing and service boundaries.

AC3: Usage, audit, metrics, and health records retain provider and project dimensions correctly across all provider combinations.

AC4: No canonical route, canonical schema, search service contract, or usage/audit boundary is rewritten for provider-specific behavior; provider-specific logic stays confined to provider adapters, routing policy, registry wiring, and repository-backed policy resolution.

AC5: Per-project, per-capability provider bindings remain configurable through the admin API, and can support multi-provider binding, fallback ordering, and provider enable/disable without breaking the existing control model.

AC6: The operator console can inspect and manage multi-provider state, including provider-aware credential management, provider-aware binding configuration, provider health visibility, and provider-scoped usage/stats views.

AC7: `bash scripts/validate.sh` remains the delivery gate and passes after each sub-phase, with targeted provider tests and integration coverage added for every new provider.

## Constraints

- Do not add a new canonical capability in this phase unless required for provider parity.
- Do not leak provider-specific knobs into canonical top-level request or response fields.
- Keep Brave as a first-class supported provider throughout the phase.
- Provider-specific schemas must stay inside `src/providers/<name>/`.
- Transport handlers must not access repositories directly.
- Services must not depend on HTTP response objects.
- Raw provider secrets must never be logged or stored in plaintext.
- All provider HTTP calls are mocked in unit tests; real provider calls stay in manual verification flows only.
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

- Multi-provider racing or fanout
- Cost-optimization routing
- Billing
- Provider passthrough API
- OpenAI-compatible proxy endpoints
- New non-search product surfaces
- Rewriting the operator console beyond the multi-provider management work called out in this phase

## Provider Capability Matrix

| Capability | Brave | Tavily | Kagi | SerpAPI |
|-----------|-------|--------|------|---------|
| `search.web` | ✅ | ✅ | ✅ | ✅ |
| `search.news` | ✅ | — | ✅ | ✅ |
| `search.images` | ✅ | — | — | ✅ |

After completion, every MVP capability should be covered by at least 2 providers.

## Validation Commands

Every task in this phase must continue to pass:

```bash
bash scripts/validate.sh
```

Each provider-specific slice should also include targeted adapter tests and routing or integration tests appropriate to the change.

## Phase 4A: Tavily (2-provider validation)

**Status:** Completed

**Why first:** Tavily is the lowest-friction fit for canonical `search.web`, so it was the safest provider to use for validating multi-provider registry, fallback, and routing behavior without disturbing existing contracts.

### Task 41: Tavily adapter implementation [AC1]

- Create `src/providers/tavily/schemas.ts`
- Create `src/providers/tavily/client.ts`
- Create `src/providers/tavily/mapper.ts`
- Create `src/providers/tavily/adapter.ts`
- Map canonical `search.web` requests into Tavily request shape
- Normalize Tavily response shape back into canonical search items
- Add typed provider error handling and health probe behavior

### Task 42: Tavily registration, allowlist, and unit tests [AC1][AC2]

- Modify `src/app/build-app.ts` to register `TavilyAdapter`
- Modify `src/modules/admin/service/admin-service.ts` to allow `"tavily"`
- Create `tests/providers/tavily-adapter.test.ts`
- Ensure Brave and Tavily can coexist in the provider registry without canonical route changes

### Task 43: Two-provider routing integration tests [AC2][AC3]

- Create or extend `tests/routing/multi-provider-routing.test.ts`
- Cover default provider selection from project binding
- Cover Brave → Tavily fallback on retryable failure and the reverse direction
- Cover explicit `provider: "tavily"` routing
- Cover health-aware exclusion and usage attribution to the actual successful provider
- Prove non-retryable failures fail fast without fallback

### Task 44: Tavily dev seed and documentation [AC7]

- Modify `src/app/bootstrap.ts` to seed Tavily binding and `TAVILY_API_KEY`
- Modify `docs/debugging.md` with Tavily environment variables, capability info, and local verification notes
- Verify local in-memory seed order keeps Brave default with Tavily fallback for `search.web`

## Phase 4B: Kagi (3-provider, per-capability routing)

**Status:** In Progress

**Why second:** Kagi introduces additional capability and routing shape tension, especially around web/news capability overlap and response-envelope error handling. It is the first real proof that the abstractions hold beyond the minimal two-provider case.

### Task 45: Kagi adapter implementation [AC1]

- Create `src/providers/kagi/schemas.ts`
- Create `src/providers/kagi/client.ts`
- Create `src/providers/kagi/mapper.ts`
- Create `src/providers/kagi/adapter.ts`
- Map canonical request fields into Kagi query parameters and response filtering rules
- Handle Kagi `2xx + error[]` envelope failures as typed `ProviderError`s
- Support capability-specific filtering and health probe behavior

### Task 46: Kagi registration and 3-provider routing tests [AC1][AC2]

- Modify `src/app/build-app.ts` to register `KagiAdapter`
- Modify `src/modules/admin/service/admin-service.ts` to allow `"kagi"`
- Create `tests/providers/kagi-adapter.test.ts`
- Extend `tests/routing/multi-provider-routing.test.ts` with three-provider fallback and capability-aware scenarios
- Validate explicit provider selection and all-unhealthy rejection across Brave, Tavily, and Kagi

### Task 47: Kagi dev seed and documentation [AC7]

- Modify `src/app/bootstrap.ts` to seed Kagi binding and `KAGI_API_KEY`
- Modify `docs/debugging.md` with Kagi setup and capability info
- Keep local seeded ordering deterministic across Brave, Tavily, and Kagi

## Phase 4C: SerpAPI (full capability coverage)

**Status:** In Progress

**Why third:** SerpAPI is the provider that completes full MVP capability coverage across `search.web`, `search.news`, and `search.images`, which makes it the strongest final proof that the canonical model can scale horizontally.

### Task 48: SerpAPI adapter implementation [AC1]

- Create `src/providers/serpapi/schemas.ts`
- Create `src/providers/serpapi/client.ts`
- Create `src/providers/serpapi/mapper.ts`
- Create `src/providers/serpapi/adapter.ts`
- Map web, news, and images canonical requests into SerpAPI query shapes
- Normalize capability-specific SerpAPI result structures back into canonical items
- Add typed provider error handling and health probe behavior

### Task 49: SerpAPI registration and full-coverage routing tests [AC1][AC2][AC3]

- Modify `src/app/build-app.ts` to register `SerpApiAdapter`
- Modify `src/modules/admin/service/admin-service.ts` to allow `"serpapi"`
- Create `tests/providers/serpapi-adapter.test.ts`
- Extend `tests/routing/multi-provider-routing.test.ts` for four-provider capability coverage
- Prove every MVP capability has at least two providers
- Prove per-project isolation and usage attribution across all provider combinations

### Task 50: SerpAPI dev seed and documentation [AC7]

- Modify `src/app/bootstrap.ts` to seed SerpAPI binding and `SERPAPI_API_KEY`
- Modify `docs/debugging.md` with SerpAPI environment variables and local verification notes
- Update capability matrix and manual verification steps for full coverage

## Phase 4D: Operator Console Multi-Provider Support

**Status:** Planned

**Goal:** Extend the existing operator console from Brave/Tavily/Kagi control to a true multi-provider management surface without creating a new frontend product boundary.

### Task 51: Provider stats breakdown endpoint [AC3][AC6]

- Add an admin endpoint for provider-level request breakdown
- Keep implementation inside service + repository boundaries
- Add tests covering provider aggregation and project scoping

### Task 52: Registered providers list endpoint [AC5][AC6]

- Add an admin endpoint exposing registered provider IDs, capabilities, and operator-safe metadata
- Reuse provider registry and health service instead of duplicating provider declarations
- Add tests for provider list shape and health visibility

### Task 53: Project Detail multi-provider support [AC5][AC6]

- Update `frontend` project detail flows to support provider-aware credential attachment and binding management
- Remove Brave-only assumptions from credential and binding forms
- Support provider selection, capability selection, enable/disable, and priority editing

### Task 54: Dashboard provider breakdown [AC3][AC6]

- Add provider-level request breakdown to the dashboard
- Respect existing project scoping and filtering behavior
- Reuse the provider stats endpoint from Task 51

### Task 55: Usage page provider filter [AC3][AC6]

- Add provider filter controls to usage browsing and export flows
- Keep query behavior aligned with existing admin usage endpoints
- Ensure CSV/export preserves provider attribution

### Task 56: Providers page [AC6]

- Add a provider health and capability overview page in the operator console
- Display provider name, capabilities, health, and recent latency/availability data
- Reuse `/v1/health/providers` and provider list/admin metadata endpoints

### Task 57: Frontend tests for multi-provider console [AC6][AC7]

- Add or extend frontend tests for provider-aware dashboard, usage, project detail, and providers page behavior
- Keep validation scope aligned with existing `frontend` test and build tooling

## Phase 4E: End-to-End Validation

**Status:** Planned

### Task 58: Multi-provider integration and E2E verification [AC2][AC3][AC4]

- Add backend integration coverage proving multi-provider routing across the full registered set
- Cover default selection, fallback, explicit provider selection, disabled binding exclusion, and provider attribution
- Add any minimal browser/E2E validation needed for the operator console multi-provider flow without bloating the default delivery gate

### Task 59: Final documentation and validation pass [AC7]

- Update `docs/debugging.md` with final provider matrix, environment variables, and local verification instructions
- Reconfirm architecture fences and AC coverage checks
- Run full validation and close remaining documentation gaps

## Execution Order and Dependencies

```text
Phase 4A: Tavily
  Task 41 -> Task 42 -> Task 43 -> Task 44

Phase 4B: Kagi
  Task 45 -> Task 46 -> Task 47

Phase 4C: SerpAPI
  Task 48 -> Task 49 -> Task 50

Phase 4D: Operator Console
  Task 51 -> Task 52
  Task 53, Task 54, Task 55, Task 56 can proceed in parallel after 51-52
  Task 57 closes frontend test coverage after 53-56

Phase 4E: Validation
  Task 58 depends on the relevant provider and operator-console slices
  Task 59 is the final doc + validation closure step
```

Adapter implementations are largely independent, but registry/routing and operator-console work should stay sequenced behind the providers they depend on. Do not widen scope across phases unless this same authoritative document is updated first.

## Architecture Fence Compliance

| Rule | How Phase 4 complies |
|------|----------------------|
| Transport → Repository banned | New HTTP endpoints must call services, not repositories directly |
| Service → HTTP response banned | Service and adapter layers return domain data, not HTTP response objects |
| Provider schemas internal only | Each provider keeps request/response types inside `src/providers/<name>/` |
| Canonical routes provider-neutral | Provider-specific branching stays out of `/v1/search/*` route definitions |
| Secrets encrypted at rest | All provider credentials continue to flow through `CredentialService` |
| Frontend → HTTP only | Operator console uses admin and health APIs, never direct DB or Redis access |
| Validate gate preserved | `bash scripts/validate.sh` remains mandatory after every task slice |
| AC coverage enforced | New work must maintain AC tag coverage through code, tests, and docs |

## Risk Notes

| Risk | Mitigation |
|------|-----------|
| Provider API drift | Keep mapping and error handling isolated per adapter |
| Envelope-style provider errors | Add explicit regression tests at the provider client level |
| Routing complexity growth | Prove determinism with focused routing integration tests at each expansion step |
| Frontend Brave-only assumptions | Remove hardcoded provider assumptions behind provider list/admin endpoints |
| Scope creep across phases | Update this authoritative plan before starting plan-external work |

## Success Criteria

Phase 4 is complete when:

1. Brave, Tavily, Kagi, and SerpAPI are registered through the same provider architecture. [AC1]
2. Routing and fallback remain deterministic across all configured providers. [AC2]
3. Usage, audit, metrics, and health views preserve provider attribution and project isolation. [AC3]
4. Canonical routes remain provider-neutral and architecture fences remain intact. [AC4]
5. Per-project, per-capability multi-provider configuration works through admin APIs and the operator console. [AC5][AC6]
6. `bash scripts/validate.sh` passes with all new provider and console coverage in place. [AC7]

## Backup Direction

If Phase 4 is intentionally deferred, the backup direction remains vertical capability expansion:

- define one new canonical capability
- implement it on one provider first, likely Brave
- expand other providers only after the shared contract is stable

That backup path exists to widen product value without weakening the architectural rule that canonical capability design comes before provider-specific special cases.

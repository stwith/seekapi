# SeekAPI Global Architecture

**Date:** 2026-03-21

## Product Positioning

SeekAPI is an API service dispatcher and manager.
It sits between downstream clients and upstream API providers.

In the current stage, the only fully supported upstream path is Brave Search via BYOK.
The system must still preserve clean compatibility boundaries so additional providers can be added later without rewriting the core flow.

This means the product should be understood in two layers:

- a stable downstream API surface for projects and clients
- a provider adapter layer that can translate the stable surface into upstream provider calls

The near-term objective is not breadth.
The near-term objective is to make the Brave Search API path complete, reliable, observable, and operable.

## Product Scope by Stage

### Stage 1: MVP foundation

Completed in the first implementation phase:

- canonical search endpoints for web, news, and images
- downstream API key auth
- project context resolution
- Brave adapter wiring
- deterministic routing and fallback scaffolding
- rate limiting, health, usage, audit, telemetry hooks
- CI, validation, smoke, and local operator workflow

### Stage 2: Brave path productionization

The next stage should deepen one path instead of widening the matrix.
That means:

- make Brave the fully reliable search provider path
- move remaining in-memory/demo flows to repository-backed behavior
- persist and query the important operational records
- harden health, limits, credentials, and operator workflows

### Stage 3: horizontal provider expansion

Only after the Brave path is solid should the system expand horizontally.

The main objective of Stage 3 should be:

- add at least one additional provider
- keep the downstream canonical API unchanged
- prove that routing, credential resolution, health, usage, and audit all still work under one shared execution model

This stage is the clearest validation that SeekAPI is an API dispatcher and manager rather than a Brave-only wrapper.

### Backup direction: vertical capability expansion

Vertical capability expansion should remain the backup direction, not the next default stage.

This means:

- define one new canonical capability such as `search.answer`, `search.extract`, or `search.serp`
- implement it on one provider first
- add broader provider support later only after the shared capability semantics are stable

This is primarily a canonical API expansion path, not a Brave-only customization path.
In practice, the first implementation may still land on Brave if Brave is the best-supported provider for that capability.

## System Model

SeekAPI has three major planes.

### 1. Control Plane

This plane manages project-scoped configuration and policy.

Core responsibilities:

- project records
- downstream API keys
- upstream provider credential bindings
- provider enablement and default provider policy
- fallback ordering and capability permissions

This plane is the source of truth for who can call what and which upstream credential should be used.

### 2. Execution Plane

This plane handles live request processing.

Core responsibilities:

- authenticate downstream request
- resolve project context and policy
- enforce rate limits
- choose provider deterministically
- load provider credential
- execute provider request through adapter
- normalize response
- emit usage, audit, and telemetry

This is the hot path.
It should stay small, typed, deterministic, and easy to reason about.

### 3. Observability and Operations Plane

This plane exists so the gateway can be run as a service rather than as a code demo.

Core responsibilities:

- gateway readiness
- provider health snapshots
- usage event recording
- audit event recording
- request and fallback metrics
- local verification and debugging workflow

## Core Entities

The system revolves around a small set of stable entities:

- `Project`
  the tenant boundary for downstream callers
- `ApiKey`
  the downstream credential used to authenticate a caller into a project
- `ProviderCredential`
  the upstream secret or binding for a provider such as Brave
- `ProviderBinding`
  which providers a project may use and under which capabilities
- `RoutingPolicy`
  default provider and ordered fallback behavior
- `UsageEvent`
  one request execution record
- `AuditLog`
  one security or control-plane relevant record
- `ProviderHealthSnapshot`
  recent provider health state for operational decisions

These entities matter more than any individual transport route.
If they remain stable, the product can evolve without contract churn.

## Request Lifecycle

The stable request lifecycle should be:

1. Client sends a canonical request to `/v1/search/*`.
2. Auth layer validates downstream API key and resolves project context.
3. Policy layer checks capability access and request limits.
4. Routing layer selects the Brave path or another allowed provider later.
5. Credential layer resolves the project's provider credential.
6. Provider adapter translates canonical request into upstream Brave request.
7. Upstream response is translated back into canonical response.
8. Usage, audit, metrics, and health side effects are recorded.
9. Client receives normalized output with stable semantics.

Every future provider should fit into this same lifecycle.
That is the compatibility contract the architecture must preserve.

## Architecture Boundaries

The following boundaries are non-negotiable:

- HTTP transport validates and authenticates, but does not reach into persistence directly
- services orchestrate project resolution, routing, policy, and execution
- repositories own PostgreSQL access
- provider adapters own upstream HTTP, mapping, and typed provider errors
- canonical request and response contracts stay provider-neutral
- raw provider secrets are never stored or logged in plaintext

The current repo already enforces most of this at the module level.
Stage 2 should make the runtime behavior fully match those boundaries.

## Current Strategic Focus

The product should not be described as "many providers soon."
The correct strategic focus is:

- one fully usable Brave Search path
- one clean canonical contract
- one project-scoped control model
- one observable and operable gateway runtime

Compatibility for future providers matters, but future providers are not the current delivery target.

## Stage 2 Design Priorities

Stage 2 should optimize for production readiness of the Brave path.

Priority order:

1. Replace in-memory project, auth, and credential flows in the hot path.
2. Persist and query usage, audit, and provider health records.
3. Make rate limiting, health, and fallback operationally trustworthy.
4. Keep the canonical contract stable while tightening Brave-specific execution quality.
5. Preserve provider adapter boundaries so the next provider can be added later without refactor.

## Out of Scope for Stage 2

Stage 2 should explicitly avoid:

- adding an admin UI
- adding billing
- adding OpenAI-compatible chat proxying
- adding non-search API products
- adding speculative multi-provider fanout
- widening canonical capability surface before the Brave path is solid

## Stage 3 Design Priorities

Once Stage 2 is complete, the next primary priorities should be:

1. Add a second provider without changing downstream canonical routes.
2. Prove repository-backed project, credential, and routing policy flows work across providers.
3. Compare provider health, fallback, usage, and audit behavior under one common execution model.
4. Keep provider-specific differences isolated in adapters instead of leaking into shared contracts.

## Backup Capability Strategy

If Stage 3 provider expansion is intentionally deferred, the backup growth path is canonical capability expansion.

The rule for that work should be:

1. define the canonical capability first
2. implement it on one provider first, likely Brave if it is the strongest fit
3. expand to other providers only after the shared contract is stable

This keeps capability growth from turning into provider-specific contract drift.

## Success Definition

SeekAPI is successful at the end of Stage 2 when:

- a project can be configured with a Brave credential through supported service flows
- downstream callers can use stable canonical search endpoints against Brave reliably
- usage, audit, rate limit, and health records reflect real runtime behavior
- the local and CI validation story stays deterministic
- the architecture still leaves room for future providers without redesign

# Product Rules

## Product Definition

This project is a pure API gateway for search capabilities.
It is not a UI product, not a general LLM proxy, and not a billing platform.

The gateway exposes canonical search endpoints and routes requests to upstream search providers through provider adapters.

## Initial Scope

The first supported mode is:

- downstream project API keys
- upstream BYOK credentials
- Brave as the first provider
- canonical endpoints for web, news, and image search
- operator-facing admin console for internal management of the Brave-only distributor flow

## Product Boundary

### In Scope

- Canonical search API
- Provider adapter model
- Project-scoped credentials and policies
- Deterministic provider routing and fallback
- Usage logs, audit logs, health, and basic rate limits
- Operator-facing admin UI for internal control-plane management

### Out of Scope for MVP

- User-facing billing
- Model chat proxying
- General browser automation
- Long-term caching of provider responses
- Workflow orchestration
- Multi-provider race execution
- Non-search product surfaces
- End-user self-serve dashboard
- Tenant-facing login, registration, and profile management

## Capability Boundary

Canonical capabilities are:

- `search.web`
- `search.news`
- `search.images`
- `search.answer`
- `search.extract`
- `search.serp`

Only the first three are MVP deliverables.
The others are reserved to shape future expansion without breaking contracts.

## Canonical API Boundary

Clients should integrate with canonical endpoints first.
Provider-specific features may exist, but they must not leak into the canonical contract unless deliberately promoted.

Allowed in canonical request and response:

- common query parameters
- common filtering fields
- normalized result items
- normalized citations and answer fields when a capability needs them
- provider-specific `extensions` and `raw`

Not allowed in canonical contract unless explicitly promoted:

- provider-only knobs as top-level fields
- provider response modules that have no cross-provider meaning
- direct exposure of upstream response envelopes

## Routing Boundary

Routing behavior must remain deterministic and explainable.

Allowed in MVP:

- explicit provider selection
- project default provider
- ordered fallback provider list
- health-aware fallback

Not allowed in MVP:

- opaque heuristic routing
- dynamic cost optimization
- speculative parallel provider execution

## Acceptance Criteria Rules

Every active implementation plan must include:

- Goal
- Acceptance Criteria
- Constraints
- Non-Goals
- Validation commands

Every AC must map to at least one test, smoke check, or deterministic validation artifact.

## Change Control

When introducing a new provider or new capability:

1. Update this product document if the product boundary changes.
2. Update [docs/architecture.md](/Users/cjs/Codes/seekapi/docs/architecture.md) if the layering or module rules change.
3. Add or update a plan in [docs/plans/](/Users/cjs/Codes/seekapi/docs/plans).
4. Update examples and validation scripts if new behavior changes the delivery gate.

When introducing a new operator-facing product surface:

1. Keep the canonical search API as the primary product boundary.
2. Ensure the UI remains an operator console, not an end-user product surface, unless this document is updated again.
3. Keep downstream auth model unchanged: clients still authenticate with SeekAPI keys, not UI sessions.
4. Update [docs/architecture.md](/Users/cjs/Codes/seekapi/docs/architecture.md) if frontend boundaries or runtime packaging rules change.

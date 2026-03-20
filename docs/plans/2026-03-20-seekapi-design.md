# SeekAPI Design

**Date:** 2026-03-20

**Status:** Draft

**Goal:** Build SeekAPI, a pure API gateway for search and agent-facing service providers that starts with Brave BYOK and can add Tavily, Kagi, SerpAPI, Perplexity, and Firecrawl without rewriting the core architecture.

## Summary

The system should be a capability-first gateway, not a provider-branded proxy.
Clients call a stable canonical API such as `/v1/search/web`.
The gateway authenticates the caller, resolves project policy, selects a provider, executes through a provider adapter, normalizes the response, and records usage and audit events.

The first release should stay intentionally small:

- Pure API gateway
- BYOK provider credentials
- Brave only
- Web, news, and image search
- Project-scoped API keys
- Basic rate limiting, usage logging, provider health, and fallback

The architecture should optimize for extension, not premature distribution.
A modular monolith is the right starting point.

This repository should also follow a harness-style engineering model:

- `AGENTS.md` is the entrypoint for agents
- `docs/product.md` defines product boundary and non-goals
- `docs/architecture.md` defines layering and dependency rules
- `docs/plans/` holds active plans and templates
- `scripts/validate.sh` is the delivery gate
- `scripts/check-architecture.sh` and `scripts/check-ac-coverage.sh` act as mechanical guards
- `scripts/smoke.sh`, `scripts/dev.sh`, and `scripts/seed-demo-data.sh` define the runnable harness surface

## Requirements

### Functional Requirements

- Expose canonical search endpoints for web, news, and images.
- Support project-scoped downstream API keys.
- Support BYOK upstream provider credentials.
- Route requests to a selected provider explicitly or via project policy.
- Normalize provider responses into a canonical schema.
- Preserve provider-specific data in extensions/raw payloads.
- Track usage, latency, provider choice, and fallback behavior.
- Enforce rate limits and project capability access.
- Expose provider and gateway health endpoints.

### Non-Functional Requirements

- Fast path overhead added by the gateway should stay under 30ms p95 excluding upstream latency.
- The gateway should support horizontal scaling behind a load balancer.
- State should remain externalized in PostgreSQL and Redis.
- Logging, metrics, and traces should be available from the first release.
- Provider adapters should be isolated enough that adding a new one does not require changes to request handling flow.

### Explicit Non-Goals for MVP

- No admin UI
- No billing engine
- No long-term search result caching
- No answer synthesis layer
- No OpenAI-compatible API facade
- No async job orchestration
- No multi-provider parallel racing

## Architecture Decision

### Chosen Pattern

`TypeScript modular monolith with capability-first provider adapters`

### Why This Pattern

- The complexity is primarily protocol translation and policy control, not compute.
- One deployable service keeps iteration, debugging, and onboarding simple.
- Module boundaries allow later extraction if real scaling pressure appears.
- Provider adapters create the extension point needed for Tavily, Kagi, SerpAPI, Perplexity, and Firecrawl.

### Why Not Microservices

- The domain boundaries are still emerging.
- Splitting too early would add network, deployment, and operational complexity without reducing core risk.
- The likely first scaling bottleneck is upstream provider latency, not internal CPU.

### Why TypeScript

- Excellent fit for JSON-heavy HTTP systems.
- Shared types across API schemas, adapters, and future SDKs.
- Lower contribution barrier for an open source gateway.
- Fastify plus Zod covers validation, performance, and ergonomics well enough for this problem.

## Harness Integration

The design should not only describe runtime architecture, it should also define delivery fences.

### Required Repository Control Points

- `AGENTS.md` for entry rules
- `docs/product.md` for business boundary
- `docs/architecture.md` for layer rules
- `docs/debugging.md` for operator workflow
- `docs/plans/TEMPLATE.md` for future task plans
- `examples/` for stable usage examples
- `scripts/validate.sh` as the shared local and CI entrypoint

### Delivery Rules

- No implementation without a plan.
- Every plan must contain AC, constraints, non-goals, and validation.
- Every AC should map to tests, smoke, or another deterministic validation artifact.
- Validation should run through the same command locally and in CI.
- Architecture violations should be script-detectable where possible.

## High-Level Architecture

```text
Client
  -> Canonical API
    -> Auth Module
    -> Project Context Resolver
    -> Rate Limit / Policy Guard
    -> Routing Module
    -> Provider Registry
    -> Provider Adapter
    -> Response Normalizer
    -> Usage / Audit Pipeline
    -> Client Response

Shared infrastructure:
  - PostgreSQL
  - Redis
  - OpenTelemetry / Metrics / Logs
```

## Request Lifecycle

1. Client sends a request to a canonical endpoint such as `POST /v1/search/web`.
2. The gateway authenticates the downstream API key.
3. The gateway resolves the project and its allowed capabilities.
4. The rate limiter checks the project quota and rolling limits.
5. The routing module chooses a provider:
   - explicit provider if the request asks for one
   - otherwise project default
   - otherwise first healthy provider in fallback order for the capability
6. The gateway loads the encrypted upstream credential for that project and provider.
7. The selected provider adapter maps the canonical request to provider-specific request format.
8. The adapter executes the upstream request.
9. The adapter maps the upstream response back to canonical response plus provider extensions.
10. The gateway emits usage, audit, metrics, and trace data.
11. The gateway returns the normalized response.

## Canonical API Surface

### Endpoints

- `POST /v1/search/web`
- `POST /v1/search/news`
- `POST /v1/search/images`
- `GET /v1/providers`
- `GET /v1/capabilities`
- `GET /v1/health`

### Canonical Request Shape

```json
{
  "query": "latest AI search API pricing",
  "max_results": 10,
  "country": "US",
  "locale": "en-US",
  "include_domains": ["brave.com"],
  "exclude_domains": ["reddit.com"],
  "time_range": "month",
  "provider": "brave",
  "options": {}
}
```

### Canonical Response Shape

```json
{
  "request_id": "req_123",
  "provider": "brave",
  "capability": "search.web",
  "latency_ms": 241,
  "items": [
    {
      "title": "Brave Search API",
      "url": "https://brave.com/search/api/",
      "snippet": "Official Brave Search API overview.",
      "published_at": null,
      "source_type": "web",
      "score": null
    }
  ],
  "citations": [],
  "extensions": {},
  "raw": null
}
```

## Canonical Capability Model

The gateway should use capability names as the core abstraction rather than provider names.

Initial capability set:

- `search.web`
- `search.news`
- `search.images`
- `search.answer`
- `search.extract`
- `search.serp`

Only the first three are in MVP.
The others exist now to avoid later schema churn.

## Provider Adapter Model

Each provider should be implemented as an adapter registered behind a common interface.

```ts
export type Capability =
  | "search.web"
  | "search.news"
  | "search.images"
  | "search.answer"
  | "search.extract"
  | "search.serp";

export interface CanonicalSearchRequest {
  capability: Capability;
  query: string;
  maxResults?: number;
  country?: string;
  locale?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
  timeRange?: "day" | "week" | "month" | "year";
  provider?: string;
  options?: Record<string, unknown>;
}

export interface CanonicalSearchResponse {
  requestId: string;
  provider: string;
  capability: Capability;
  latencyMs: number;
  items: SearchItem[];
  answer?: string;
  citations?: Citation[];
  extensions?: Record<string, unknown>;
  raw?: unknown;
}

export interface ProviderAdapter {
  id: string;
  supportedCapabilities(): Capability[];
  validateCredential(input: unknown): Promise<void>;
  execute(
    req: CanonicalSearchRequest,
    ctx: ProviderExecutionContext
  ): Promise<CanonicalSearchResponse>;
  healthCheck(ctx: ProviderHealthContext): Promise<ProviderHealthStatus>;
}
```

### Design Rules for Adapters

- Adapters own provider-specific HTTP clients and schema mapping.
- Adapters must not contain project policy logic.
- Adapters should return canonical fields plus provider-specific extensions.
- Adapters should fail with typed errors that the routing layer can classify for fallback decisions.

## Routing Design

### MVP Routing Rules

Routing should be deterministic and explainable.

Decision order:

1. If the request explicitly sets `provider`, use it if allowed and healthy.
2. Else use the project default provider for that capability.
3. Else use the first healthy provider from the project's fallback order for that capability.

### Fallback Rules

Fallback should trigger only on retryable provider errors:

- 5xx upstream failures
- transport timeouts
- provider health marked degraded or unavailable
- provider-specific rate limit if another allowed provider exists

Fallback should not trigger on:

- invalid downstream request
- missing or invalid upstream credentials
- forbidden capability
- project rate limit violation

### Why This Routing Model

- Easy to reason about
- Easy to document
- Easy to test
- Compatible with later cost-aware or latency-aware routing

## Data Model

The system should keep business truth in PostgreSQL and ephemeral counters/state in Redis.

### PostgreSQL Tables

#### `projects`

- `id`
- `name`
- `status`
- `created_at`
- `updated_at`

#### `api_keys`

- `id`
- `project_id`
- `name`
- `hashed_key`
- `status`
- `last_used_at`
- `created_at`

#### `provider_credentials`

- `id`
- `project_id`
- `provider`
- `encrypted_secret`
- `metadata_json`
- `status`
- `validated_at`
- `created_at`
- `updated_at`

#### `provider_bindings`

- `id`
- `project_id`
- `provider`
- `capability`
- `enabled`
- `priority`

#### `routing_policies`

- `id`
- `project_id`
- `capability`
- `default_provider`
- `fallback_order_json`
- `allow_explicit_override`

#### `usage_events`

- `id`
- `request_id`
- `project_id`
- `api_key_id`
- `provider`
- `capability`
- `status_code`
- `success`
- `latency_ms`
- `result_count`
- `fallback_count`
- `estimated_cost`
- `created_at`

#### `audit_logs`

- `id`
- `project_id`
- `actor_type`
- `actor_id`
- `action`
- `resource_type`
- `resource_id`
- `details_json`
- `created_at`

#### `provider_health_snapshots`

- `id`
- `provider`
- `capability`
- `status`
- `latency_ms`
- `checked_at`

### Redis Responsibilities

- Request rate limit counters
- Short-lived provider circuit breaker state
- Optional short-lived provider health cache

Redis should not hold authoritative credential or policy data.

## Module Breakdown

### `auth`

- Validate downstream API keys
- Resolve project context
- Enforce capability access

### `projects`

- Project lookup and API key ownership
- Provider binding and routing policy lookup

### `providers`

- Adapter registry
- Credential loading
- Health checks
- Provider metadata exposure

### `routing`

- Provider selection
- Fallback handling
- Error classification

### `capabilities`

- Canonical endpoint handlers
- Request validation
- Response shaping

### `usage`

- Request accounting
- Estimated cost recording
- Result counts and latency events

### `audit`

- Security and configuration events
- Sensitive operation logs

### `health`

- Gateway health endpoint
- Provider readiness reporting

## Product Boundary and Fences

To prevent scope drift, the harness should enforce these boundaries:

- Canonical API remains capability-first, not provider-first.
- Provider-specific features stay inside adapters unless promoted to shared contract.
- HTTP handlers may not bypass services.
- Services may not shape HTTP responses directly.
- New capabilities require updates to product, architecture, plan, and examples.
- New providers require adapter tests and routing coverage before merge.

## Error Model

The gateway should standardize errors regardless of provider.

Examples:

- `AUTH_INVALID_API_KEY`
- `AUTH_FORBIDDEN_CAPABILITY`
- `RATE_LIMIT_EXCEEDED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `PROVIDER_BAD_CREDENTIAL`
- `REQUEST_INVALID`
- `INTERNAL_ERROR`

Error responses should include:

- stable machine-readable error code
- human-readable message
- request id
- provider if relevant

## Observability

The system should emit:

- structured logs for every request
- request metrics by capability, provider, project, and status
- traces around routing and upstream execution
- provider health summaries

Minimum metrics:

- request count
- request latency
- upstream latency
- error count by code
- fallback count
- provider selection count
- rate-limit rejection count

## Validation Gates

The repository-level delivery gate should be:

```bash
bash scripts/validate.sh
```

That script should eventually run:

- lint
- typecheck
- tests
- build
- architecture checks
- AC coverage checks
- smoke

## Security and Secret Handling

- Store downstream API keys as one-way hashes.
- Store upstream provider credentials encrypted at rest.
- Never log raw provider secrets.
- Redact authorization headers and provider response fragments that may contain sensitive data.
- Separate authentication failures from provider failures in logs and metrics.

## Provider Expansion Strategy

The chosen abstraction is designed so new providers add code but do not reshape the platform.

### Brave

- Fits `search.web`, `search.news`, `search.images`
- Good first provider for MVP

### Tavily

- Adds `search.answer`
- Likely also maps to `search.web`
- Provider-specific answer and raw content should live in `extensions`

### Kagi

- Primarily `search.web`
- Personalization-specific behavior should remain provider-specific metadata

### SerpAPI

- Maps to `search.web`
- Can later add `search.serp` for rich SERP modules without polluting canonical web search

### Perplexity

- Search results can map to `search.web`
- Sonar-style search-backed responses map to `search.answer`

### Firecrawl

- Search maps to `search.web`
- Search-and-scrape or markdown extraction maps to `search.extract`

## API Compatibility Strategy

The gateway should support two layers over time:

### Canonical API

Stable internal abstraction for most users.

Examples:

- `POST /v1/search/web`
- `POST /v1/search/news`
- `POST /v1/search/images`

### Provider Passthrough API

Optional escape hatch for advanced users and migrations.

Examples:

- `POST /v1/providers/brave/search/web`
- `POST /v1/providers/tavily/search`

Passthrough is not required for MVP, but the design should preserve the option.

## Suggested Repository Shape

```text
src/
  app/
  config/
  modules/
    auth/
    projects/
    providers/
    routing/
    capabilities/
    usage/
    audit/
    health/
  providers/
    core/
      types.ts
      registry.ts
      errors.ts
    brave/
      adapter.ts
      client.ts
      mapper.ts
      schemas.ts
  infra/
    db/
    redis/
    http/
    telemetry/
  jobs/
  lib/
```

## MVP Definition

Release 1 should include:

- One Fastify service
- PostgreSQL and Redis
- Brave adapter only
- Canonical endpoints for web, news, and images
- Downstream API key auth
- Project-scoped Brave credential storage
- Basic routing and fallback scaffolding
- Usage and audit events
- Gateway and provider health endpoints

Release 1 should exclude:

- UI
- billing
- provider passthrough
- answer generation
- extract workflows
- multi-region deployment

## ADR Summary

### ADR-001: Modular Monolith Over Microservices

Chosen because the domain is still forming and the cost of distribution would exceed the benefit.

### ADR-002: Capability-First API Over Provider-First API

Chosen to keep the client contract stable while allowing provider growth.

### ADR-003: Canonical Schema Plus Extensions

Chosen so common fields remain stable but provider-specific features are not lost.

### ADR-004: PostgreSQL Plus Redis

Chosen because the gateway needs strong relational configuration data plus low-latency counters and transient state.

### ADR-005: TypeScript Over Go for MVP

Chosen because development speed, schema ergonomics, and contribution friendliness matter more than raw throughput for the first release.

## Open Questions

- Whether provider passthrough should ship in release 2 or later
- Whether per-project cost ceilings should exist before billing support
- Whether gateway-managed response caching is desirable once more providers are added
- Whether KMS-backed secret storage should be required from day one or only in hosted deployments

## Recommended Next Document

The next step should be an implementation plan that breaks this design into small tasks for a coding agent to execute.

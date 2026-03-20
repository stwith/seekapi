# Architecture Rules

## Core Architecture

The system uses a modular monolith with capability-first provider adapters.

Primary stack:

- TypeScript
- Node.js
- Fastify
- PostgreSQL
- Redis

## Module Boundaries

Top-level responsibilities:

- `app/`
  composition and bootstrapping
- `modules/auth`
  downstream API key auth and request context
- `modules/projects`
  project configuration and policy lookup
- `modules/capabilities`
  canonical API handlers and application services
- `modules/routing`
  provider choice and fallback
- `modules/providers`
  provider registration and credential lookup
- `modules/usage`
  usage event recording and metrics hooks
- `modules/audit`
  audit event recording
- `modules/health`
  health reporting
- `providers/`
  provider-specific adapters and mappers
- `infra/`
  database, redis, http, telemetry

## Dependency Rules

Allowed:

- transport -> service
- service -> repository
- service -> provider registry / provider adapter
- app -> modules
- modules -> infra

Disallowed:

- transport -> repository
- service -> HTTP response objects
- provider adapter -> transport layer
- provider adapter -> unrelated module internals
- repository -> transport layer

## Validation Rules

- HTTP schema validation happens at the transport boundary.
- Internal services receive typed canonical input.
- Persistence entities are not returned directly from HTTP handlers.
- Provider-specific schemas stay inside provider adapters.

## Canonical Contract Rules

The canonical contract is the stable boundary for clients.

Requirements:

- canonical routes reflect capability, not provider name
- canonical request shapes only include common fields
- canonical response shapes only include normalized fields plus `extensions` and `raw`
- provider-specific details must be mapped, not leaked

## Provider Adapter Rules

Each provider adapter must:

- declare supported capabilities
- validate credentials
- map canonical requests to provider format
- map provider responses to canonical format
- emit typed, classifiable errors

Each provider adapter must not:

- read HTTP request objects directly
- enforce project auth rules
- bypass routing policy
- write directly to unrelated modules

## Persistence Rules

- PostgreSQL stores source-of-truth configuration and event records.
- Redis stores ephemeral rate limit and health state only.
- Secrets must be encrypted at rest.
- Raw secrets must never be written to logs.

## Harness Rules

The repository must preserve these harness controls:

- no implementation without a plan
- every plan includes AC, constraints, non-goals, and validation
- `bash scripts/validate.sh` is the delivery gate
- architecture checks must fail clearly on layer violations
- smoke scripts must exist for the main runnable path

## Review Gates

Before review, changes must satisfy:

1. Work matches the active plan.
2. ACs have evidence.
3. Failure and boundary paths were validated.
4. Architecture checks pass.
5. Clean-environment setup is documented.
6. Docs and examples are in sync.

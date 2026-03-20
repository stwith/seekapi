# SeekAPI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the MVP of SeekAPI, a pure API gateway with Brave BYOK support, canonical web/news/images endpoints, downstream API keys, routing policy scaffolding, and usage observability.

**Architecture:** Implement a modular monolith in TypeScript with Fastify. Keep the canonical request and response contract provider-neutral, and isolate Brave-specific logic behind a provider adapter. Persist project configuration and usage in PostgreSQL, and use Redis for rate limiting and transient provider state.

**Tech Stack:** Node.js 22, TypeScript, Fastify, Zod, Drizzle ORM, PostgreSQL, Redis, OpenTelemetry, Vitest

## Preconditions

- Repository currently contains the agent entry docs, plans, examples scaffolding, and validation scripts.
- Start by extending this baseline with the project scaffold and documentation-driven module layout.
- Use the design document at `/Users/cjs/Codes/seekapi/docs/plans/2026-03-20-seekapi-design.md` as the architecture source of truth.
- Before implementation, read `/Users/cjs/Codes/seekapi/AGENTS.md`, `/Users/cjs/Codes/seekapi/docs/product.md`, and `/Users/cjs/Codes/seekapi/docs/architecture.md`.
- Do not implement plan-external work without updating the active plan.

## Harness Acceptance Criteria

AC1: The repository has a working harness entry structure with `AGENTS.md`, core docs, validation scripts, and examples scaffolding.

AC2: The implementation follows the service and adapter boundaries defined in `docs/architecture.md`.

AC3: Canonical endpoints expose capability-first routes and keep provider-specific fields out of the shared contract unless intentionally promoted.

AC4: Brave BYOK web, news, and image search can be exercised through canonical routes.

AC5: `bash scripts/validate.sh` is the required delivery gate and is usable both locally and in CI.

AC6: Main-path smoke and debugging instructions exist and stay in sync with runnable code.

## Constraints

- Keep the project a pure API gateway.
- Keep the MVP limited to Brave plus canonical web, news, and images search.
- Do not add an admin UI, billing system, or OpenAI-compatible facade.
- Preserve the harness repository structure and keep validation script-driven.

## Non-Goals

- Multi-provider cost optimization
- Provider passthrough API in MVP
- Long-term result caching
- Search answer synthesis
- Extraction workflows
- Non-search capabilities

### Task 1: Bootstrap the repository

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`
- Create: `src/app/server.ts`
- Create: `src/app/build-app.ts`
- Create or preserve: `AGENTS.md`
- Create or preserve: `docs/product.md`
- Create or preserve: `docs/architecture.md`
- Create or preserve: `docs/debugging.md`
- Create or preserve: `examples/README.md`
- Create or preserve: `scripts/validate.sh`
- Create or preserve: `scripts/check-architecture.sh`
- Create or preserve: `scripts/check-ac-coverage.sh`
- Create or preserve: `scripts/smoke.sh`
- Create or preserve: `scripts/dev.sh`
- Create or preserve: `scripts/seed-demo-data.sh`

**Step 1: Initialize package metadata**

Create `package.json` with scripts for:

- `dev`
- `build`
- `start`
- `test`
- `lint`
- `db:generate`
- `db:migrate`

Include dependencies for Fastify, Zod, Drizzle, pg, Redis client, and OpenTelemetry.

**Step 2: Add TypeScript baseline**

Create `tsconfig.json` for strict TypeScript compilation targeting Node.js 22.

**Step 3: Add environment template**

Create `.env.example` with:

- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `ENCRYPTION_KEY`
- `LOG_LEVEL`

**Step 4: Add root README**

Document what the project is, how to run it locally, and where the architecture plan lives.

**Step 4.5: Preserve harness structure**

Make sure repository entry docs and scripts stay aligned with the design document and harness rules.

**Step 5: Commit**

```bash
git add package.json tsconfig.json .gitignore .env.example README.md src/app/server.ts src/app/build-app.ts
git commit -m "chore: bootstrap seekapi repository"
```

### Task 2: Create the module and provider skeleton

**Files:**
- Create: `src/modules/auth/index.ts`
- Create: `src/modules/projects/index.ts`
- Create: `src/modules/providers/index.ts`
- Create: `src/modules/routing/index.ts`
- Create: `src/modules/capabilities/index.ts`
- Create: `src/modules/usage/index.ts`
- Create: `src/modules/audit/index.ts`
- Create: `src/modules/health/index.ts`
- Create: `src/providers/core/types.ts`
- Create: `src/providers/core/registry.ts`
- Create: `src/providers/core/errors.ts`
- Create: `src/providers/brave/adapter.ts`
- Create: `src/providers/brave/client.ts`
- Create: `src/providers/brave/mapper.ts`
- Create: `src/providers/brave/schemas.ts`

**Step 1: Create empty module entrypoints**

Add one index file per module with exported factory placeholders.

**Step 2: Define provider core types**

Implement the canonical capability types, request and response types, provider adapter interface, and execution context types.

**Step 3: Implement provider registry skeleton**

The registry should support:

- registering providers
- listing providers
- resolving provider by id
- querying capabilities by provider

**Step 4: Add Brave adapter skeleton**

Do not fully implement HTTP calls yet.
Create the class structure and placeholder methods for:

- `supportedCapabilities`
- `validateCredential`
- `execute`
- `healthCheck`

**Step 5: Commit**

```bash
git add src/modules src/providers
git commit -m "feat: add gateway module and provider skeleton"
```

### Task 3: Define API schemas and canonical endpoints

**Files:**
- Create: `src/modules/capabilities/http/routes.ts`
- Create: `src/modules/capabilities/http/schemas.ts`
- Create: `src/modules/capabilities/service/search-service.ts`
- Create: `src/lib/request-id.ts`

**Step 1: Write the failing tests**

Create:

- `tests/capabilities/web-search.test.ts`
- `tests/capabilities/news-search.test.ts`
- `tests/capabilities/images-search.test.ts`

Tests should verify:

- valid request passes schema validation
- invalid request returns 400
- route attaches request id
- route delegates to search service with proper capability
- AC3 can be traced from tests or validation artifacts

**Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/capabilities
```

Expected:

- tests fail because route handlers and schemas do not exist yet

**Step 3: Implement schemas and routes**

Create Zod schemas for canonical requests and responses.
Wire three routes:

- `POST /v1/search/web`
- `POST /v1/search/news`
- `POST /v1/search/images`

Each route should:

- validate request
- derive capability from route
- call the search service
- return normalized output

**Step 4: Run tests to verify pass**

Run:

```bash
npm test -- tests/capabilities
```

Expected:

- all route tests pass

**Step 5: Commit**

```bash
git add src/modules/capabilities src/lib tests/capabilities
git commit -m "feat: add canonical search endpoints"
```

### Task 4: Add downstream API key authentication and project resolution

**Files:**
- Create: `src/modules/auth/http/pre-handler.ts`
- Create: `src/modules/auth/service/auth-service.ts`
- Create: `src/modules/projects/service/project-service.ts`
- Create: `tests/auth/api-key-auth.test.ts`

**Step 1: Write the failing test**

Test cases:

- missing API key returns 401
- invalid API key returns 401
- valid API key resolves project context

**Step 2: Run the test to confirm failure**

Run:

```bash
npm test -- tests/auth/api-key-auth.test.ts
```

Expected:

- missing auth middleware and services

**Step 3: Implement minimal auth flow**

Add:

- `Authorization: Bearer <key>` parsing
- hash comparison for stored keys
- project context attachment to request

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/auth/api-key-auth.test.ts
```

Expected:

- auth tests pass

**Step 5: Commit**

```bash
git add src/modules/auth src/modules/projects tests/auth
git commit -m "feat: add downstream api key authentication"
```

### Task 5: Add PostgreSQL schema and repositories

**Files:**
- Create: `src/infra/db/schema/projects.ts`
- Create: `src/infra/db/schema/api-keys.ts`
- Create: `src/infra/db/schema/provider-credentials.ts`
- Create: `src/infra/db/schema/provider-bindings.ts`
- Create: `src/infra/db/schema/routing-policies.ts`
- Create: `src/infra/db/schema/usage-events.ts`
- Create: `src/infra/db/schema/audit-logs.ts`
- Create: `src/infra/db/schema/provider-health-snapshots.ts`
- Create: `src/infra/db/client.ts`
- Create: `src/infra/db/index.ts`
- Create: `drizzle.config.ts`
- Create: `tests/db/schema.test.ts`

**Step 1: Write the failing test**

Test should verify the schema exports the expected tables and columns.

**Step 2: Run the test to confirm failure**

Run:

```bash
npm test -- tests/db/schema.test.ts
```

Expected:

- schema modules not found

**Step 3: Implement schema files**

Define the minimum columns described in the design document.

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/db/schema.test.ts
```

Expected:

- schema tests pass

**Step 5: Commit**

```bash
git add src/infra/db drizzle.config.ts tests/db
git commit -m "feat: add database schema for gateway state"
```

### Task 6: Implement provider registry and Brave adapter MVP

**Files:**
- Modify: `src/providers/core/registry.ts`
- Modify: `src/providers/brave/adapter.ts`
- Modify: `src/providers/brave/client.ts`
- Modify: `src/providers/brave/mapper.ts`
- Modify: `src/providers/brave/schemas.ts`
- Create: `tests/providers/brave-adapter.test.ts`

**Step 1: Write the failing test**

Test cases:

- Brave adapter advertises web, news, and images capabilities
- canonical request maps to Brave request format
- Brave response maps back to canonical response shape

**Step 2: Run the test to confirm failure**

Run:

```bash
npm test -- tests/providers/brave-adapter.test.ts
```

Expected:

- adapter behavior incomplete

**Step 3: Implement minimal Brave adapter**

Add:

- request mapping
- response mapping
- typed error translation
- health check placeholder

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/providers/brave-adapter.test.ts
```

Expected:

- adapter tests pass

**Step 5: Commit**

```bash
git add src/providers tests/providers
git commit -m "feat: implement brave provider adapter"
```

### Task 7: Implement routing service and fallback scaffolding

**Files:**
- Create: `src/modules/routing/service/routing-service.ts`
- Create: `src/modules/routing/service/error-classifier.ts`
- Create: `tests/routing/routing-service.test.ts`

**Step 1: Write the failing test**

Test cases:

- explicit provider wins when allowed
- project default provider is used when request omits provider
- healthy fallback provider is selected after retryable failure
- non-retryable auth errors do not fallback

**Step 2: Run the test to confirm failure**

Run:

```bash
npm test -- tests/routing/routing-service.test.ts
```

Expected:

- routing service not implemented

**Step 3: Implement routing logic**

The first version should only support:

- explicit provider
- default provider
- ordered fallback list

Do not add cost-aware routing yet.

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/routing/routing-service.test.ts
```

Expected:

- routing tests pass

**Step 5: Commit**

```bash
git add src/modules/routing tests/routing
git commit -m "feat: add deterministic provider routing"
```

### Task 8: Add usage events, audit logs, and request metrics

**Files:**
- Create: `src/modules/usage/service/usage-service.ts`
- Create: `src/modules/audit/service/audit-service.ts`
- Create: `src/infra/telemetry/index.ts`
- Create: `tests/usage/usage-service.test.ts`

**Step 1: Write the failing test**

Test cases:

- successful search emits usage event
- fallback search increments fallback count
- auth failure does not create a success usage event

**Step 2: Run the test to confirm failure**

Run:

```bash
npm test -- tests/usage/usage-service.test.ts
```

Expected:

- usage pipeline missing

**Step 3: Implement minimal usage and telemetry plumbing**

Persist usage events and expose metrics hooks.

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/usage/usage-service.test.ts
```

Expected:

- usage tests pass

**Step 5: Commit**

```bash
git add src/modules/usage src/modules/audit src/infra/telemetry tests/usage
git commit -m "feat: add usage logging and telemetry hooks"
```

### Task 9: Add Redis-backed rate limiting and health endpoints

**Files:**
- Create: `src/infra/redis/client.ts`
- Create: `src/modules/auth/service/rate-limit-service.ts`
- Create: `src/modules/health/http/routes.ts`
- Create: `tests/health/health-routes.test.ts`
- Create: `tests/auth/rate-limit.test.ts`

**Step 1: Write the failing tests**

Test cases:

- project rate limit rejects excessive traffic
- health endpoint reports gateway readiness
- provider health endpoint reports Brave status

**Step 2: Run tests to confirm failure**

Run:

```bash
npm test -- tests/health tests/auth/rate-limit.test.ts
```

Expected:

- rate limiter and health routes missing

**Step 3: Implement minimal rate limiting and health routes**

Keep rate limiting simple:

- fixed or sliding window per project
- configurable thresholds

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/health tests/auth/rate-limit.test.ts
```

Expected:

- health and rate-limit tests pass

**Step 5: Commit**

```bash
git add src/infra/redis src/modules/health src/modules/auth tests/health tests/auth
git commit -m "feat: add health endpoints and rate limiting"
```

### Task 10: Wire the application and add smoke coverage

**Files:**
- Modify: `src/app/build-app.ts`
- Modify: `src/app/server.ts`
- Create: `tests/app/smoke.test.ts`

**Step 1: Write the failing smoke test**

Test cases:

- app boots successfully
- canonical route table exists
- unauthorized request is rejected

**Step 2: Run tests to confirm failure**

Run:

```bash
npm test -- tests/app/smoke.test.ts
```

Expected:

- app wiring incomplete

**Step 3: Implement app composition**

Register:

- config
- db and redis clients
- provider registry
- auth pre-handler
- capability routes
- health routes

**Step 4: Re-run smoke test**

Run:

```bash
npm test -- tests/app/smoke.test.ts
```

Expected:

- smoke tests pass

**Step 5: Commit**

```bash
git add src/app tests/app
git commit -m "feat: compose gateway application"
```

### Task 11: Verify the MVP end-to-end

**Files:**
- Modify: `README.md`
- Create: `docs/plans/2026-03-20-local-dev-checklist.md`

**Step 1: Add local verification steps**

Document:

- how to start Postgres and Redis
- how to set environment variables
- how to run migrations
- how to seed a project, API key, and Brave credential
- how to hit `/v1/search/web`
- how `bash scripts/validate.sh` acts as the final gate

**Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected:

- all tests pass

**Step 3: Run build**

Run:

```bash
npm run build
```

Expected:

- TypeScript build succeeds

**Step 4: Start the app and perform manual smoke check**

Run:

```bash
npm run dev
```

Then manually verify:

- `GET /v1/health`
- `POST /v1/search/web` with valid downstream API key

**Step 5: Commit**

```bash
git add README.md docs/plans/2026-03-20-local-dev-checklist.md
git commit -m "docs: add local verification checklist"
```

## Guardrails for the Implementer

- Do not add provider-specific fields to canonical schemas unless they are promoted intentionally.
- Do not add new capabilities beyond those already named in the design doc.
- Do not introduce a UI or billing layer during MVP.
- Keep provider routing deterministic and testable.
- Prefer explicit typed errors over string matching.
- Keep secrets encrypted at rest and redacted in logs.
- Keep harness files current when behavior, flow, or validation changes.
- Label tests or validation artifacts with AC identifiers where practical.

## Definition of Done

- `AGENTS.md`, core docs, and scripts form a usable harness entry structure.
- Brave-backed canonical web, news, and image search endpoints exist.
- Downstream API key auth works.
- BYOK Brave credential lookup works.
- Usage events and basic metrics are emitted.
- Rate limiting is enforced.
- Health endpoints exist.
- `bash scripts/validate.sh` runs the repository delivery checks.
- Tests pass.
- Build passes.
- Local run instructions are documented.

Plan complete and saved to `docs/plans/2026-03-20-seekapi-implementation-plan.md`.
Two execution options:

**1. Subagent-Driven (this session)** - Dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open a new session with `superpowers:executing-plans`, batch execution with checkpoints

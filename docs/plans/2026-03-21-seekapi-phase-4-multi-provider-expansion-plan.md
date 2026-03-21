# Phase 4: Multi-Provider Expansion Plan

> **Goal:** Expand SeekAPI from a Brave-only gateway to a true multi-provider
> search dispatcher by adding Tavily, Kagi, and SerpAPI — with full backend
> routing/fallback support and operator console integration.

## Acceptance Criteria

- **AC1:** Each new provider adapter implements `ProviderAdapter` and passes unit tests equivalent to Brave coverage.
- **AC2:** Routing, fallback, and health-aware selection work deterministically across all registered providers.
- **AC3:** Usage, audit, and metrics correctly attribute provider for every request across all combinations.
- **AC4:** No canonical route, search service, or usage/audit layer is modified — all changes confined to provider adapters, registry, allowlist, and frontend.
- **AC5:** Per-project, per-capability provider bindings are configurable via admin API and operator console.
- **AC6:** Operator console fully supports multi-provider: credential management, binding configuration, provider-scoped stats, and provider health display.
- **AC7:** `bash scripts/validate.sh` passes after each sub-phase.

## Constraints

- Provider-specific schemas stay inside `src/providers/<name>/` — never leak to canonical contracts. [AC4]
- Adapters must not read HTTP request objects, enforce project auth, or bypass routing policy.
- Transport layer must not access repositories directly. Services must not depend on HTTP response objects. (Enforced by `scripts/check-architecture.sh`)
- Raw provider secrets must never be logged or stored in plaintext.
- All provider HTTP calls are mocked in unit tests; real calls only in manual smoke.
- `pnpm` is the only package manager (not npm or yarn).
- Every AC tag must have coverage in the codebase (enforced by `scripts/check-ac-coverage.sh`).

## Non-Goals

- Adding new canonical capabilities (`search.answer`, `search.extract`, etc.)
- Billing or usage-based pricing
- Multi-provider fanout (parallel query to multiple providers)
- Provider-specific fields in canonical request/response top-level schema
- OpenAI-compatible proxy endpoints

## Provider Capability Matrix

| Capability | Brave | Tavily | Kagi | SerpAPI |
|-----------|-------|--------|------|---------|
| search.web | ✅ | ✅ | ✅ | ✅ |
| search.news | ✅ | — | ✅ | ✅ |
| search.images | ✅ | — | — | ✅ |

After completion, every MVP capability is covered by at least 2 providers.

---

## Phase 4A: Tavily (2-provider validation)

**Why first:** Tavily's API is the closest fit to the canonical search model —
single POST endpoint, JSON in/out, built-in answer extraction. Lowest mapping
friction makes it ideal for validating multi-provider wiring.

### Tavily API Reference

| Item | Value |
|------|-------|
| Base URL | `https://api.tavily.com` |
| Auth | `api_key` field in request body |
| Search endpoint | `POST /search` |
| Supported capabilities | `search.web` |

**Request:**
```json
{
  "api_key": "<key>",
  "query": "...",
  "search_depth": "basic",
  "max_results": 5,
  "include_answer": true,
  "include_domains": ["example.com"],
  "exclude_domains": ["spam.com"]
}
```

**Response:**
```json
{
  "answer": "AI-generated answer...",
  "results": [
    { "title": "...", "url": "...", "content": "...", "score": 0.95, "published_date": "2026-03-21" }
  ]
}
```

### Task 41: Tavily adapter implementation [AC1]

**Create:**
- `src/providers/tavily/schemas.ts` — Tavily-specific request/response types (internal only)
- `src/providers/tavily/client.ts` — HTTP client with error categorization
- `src/providers/tavily/mapper.ts` — Canonical ↔ Tavily mapping
- `src/providers/tavily/adapter.ts` — `TavilyAdapter implements ProviderAdapter`

**Mapping:**
| Canonical | Tavily |
|-----------|--------|
| `query` | `query` |
| `maxResults` | `max_results` (max 20) |
| `includeDomains` | `include_domains` |
| `excludeDomains` | `exclude_domains` |
| `timeRange` | Not supported; ignore |
| `country` / `locale` | Not supported; ignore |
| Response `content` → `snippet` | Response `score` → `score` |
| Response `published_date` → `publishedAt` | Response `answer` → `answer` |

**Error categorization:**
| HTTP status | ProviderError category |
|-------------|----------------------|
| 401/403 | `bad_credential` |
| 429 | `rate_limited` |
| 5xx | `upstream_5xx` |
| Network | `timeout` |

### Task 42: Tavily registration, allowlist, and unit tests [AC1][AC2]

**Modify:**
- `src/app/build-app.ts` — `registry.register(new TavilyAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"tavily"` to `ALLOWED_PROVIDERS`

**Create:**
- `tests/providers/tavily-adapter.test.ts` — Unit tests (schema mapping, error handling, health probe, credential validation)

### Task 43: Two-provider routing integration tests [AC2][AC3]

**Create:**
- `tests/routing/multi-provider-routing.test.ts` — Integration tests:
  - Default provider selection respects project binding
  - Fallback Brave → Tavily on retryable error (and reverse)
  - Explicit `provider: "tavily"` routes correctly
  - Health-aware exclusion works across both providers
  - Usage events record correct provider for each attempt
  - Non-retryable errors (bad_credential) fail fast without fallback

### Task 44: Tavily dev seed and documentation [AC7]

**Modify:**
- `src/app/bootstrap.ts` — Add Tavily seed binding and credential (`TAVILY_API_KEY` env var)
- `docs/debugging.md` — Add Tavily env var, error patterns, and capability info

**Seed:**
```
search.web: brave (priority 0, default), tavily (priority 1, fallback)
```

---

## Phase 4B: Kagi (3-provider, per-capability routing)

**Why second:** Kagi supports web + news, testing per-capability routing —
a project can use Kagi for web but Brave for images.

### Kagi API Reference

| Item | Value |
|------|-------|
| Base URL | `https://kagi.com/api/v0` |
| Auth | `Authorization: Bot <token>` header |
| Search endpoint | `GET /search?q=...&limit=N` |
| Supported capabilities | `search.web`, `search.news` |

**Response:**
```json
{
  "meta": { "id": "...", "ms": 123 },
  "data": [
    { "t": 0, "url": "...", "title": "...", "snippet": "...", "published": "2026-03-21T..." }
  ]
}
```
Result type `t=0` = web, `t=1` = news.

### Task 45: Kagi adapter implementation [AC1]

**Create:**
- `src/providers/kagi/schemas.ts` — Kagi-specific types
- `src/providers/kagi/client.ts` — HTTP client (GET, `Bot` auth header)
- `src/providers/kagi/mapper.ts` — Canonical ↔ Kagi mapping; `t=0` → web, `t=1` → news
- `src/providers/kagi/adapter.ts` — `KagiAdapter implements ProviderAdapter`

**Mapping:**
| Canonical | Kagi |
|-----------|------|
| `query` | `q` query param |
| `maxResults` | `limit` |
| `includeDomains` | Append `site:` to query |
| `excludeDomains` | Append `-site:` to query |
| `meta.ms` → `latencyMs` | Filter by `t` for capability |

### Task 46: Kagi registration and 3-provider routing tests [AC1][AC2]

**Modify:**
- `src/app/build-app.ts` — `registry.register(new KagiAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"kagi"` to `ALLOWED_PROVIDERS`

**Create:**
- `tests/providers/kagi-adapter.test.ts` — Unit tests (web + news capabilities)

**Extend:**
- `tests/routing/multi-provider-routing.test.ts` — 3-provider scenarios:
  - Per-capability default: Kagi for web, Brave for images
  - Fallback chain: Kagi → Brave → Tavily for search.web
  - `registry.byCapability()` returns correct adapters per capability

### Task 47: Kagi dev seed and documentation [AC7]

**Modify:**
- `src/app/bootstrap.ts` — Add Kagi seed bindings (`KAGI_API_KEY` env var)
- `docs/debugging.md` — Add Kagi section

**Seed:**
```
search.web:    brave (0), kagi (1), tavily (2)
search.news:   brave (0), kagi (1)
search.images: brave (0)
```

---

## Phase 4C: SerpAPI (full capability coverage)

**Why third:** SerpAPI wraps Google/Bing and supports all 3 MVP capabilities,
completing the matrix so every capability has ≥2 providers.

### SerpAPI Reference

| Item | Value |
|------|-------|
| Base URL | `https://serpapi.com` |
| Auth | `api_key` query param |
| Search endpoint | `GET /search?engine=google&q=...&api_key=...` |
| Supported capabilities | `search.web`, `search.news`, `search.images` |

**Capability → `tbm` param:** web = (omit), news = `nws`, images = `isch`

**Response keys:** `organic_results` (web), `news_results` (news), `images_results` (images)

### Task 48: SerpAPI adapter implementation [AC1]

**Create:**
- `src/providers/serpapi/schemas.ts` — SerpAPI-specific types (web, news, images responses)
- `src/providers/serpapi/client.ts` — HTTP client (GET with query params)
- `src/providers/serpapi/mapper.ts` — 3-capability mapping
- `src/providers/serpapi/adapter.ts` — `SerpApiAdapter implements ProviderAdapter`

**Mapping:**
| Canonical | SerpAPI |
|-----------|---------|
| `query` | `q` |
| `maxResults` | `num` |
| `country` | `gl` |
| `locale` | `hl` |
| `timeRange: "day"` | `tbs=qdr:d` |
| `includeDomains` | Append `site:` to query |
| `options.engine` | `engine` param (default `"google"`) |

### Task 49: SerpAPI registration and full-coverage routing tests [AC1][AC2][AC3]

**Modify:**
- `src/app/build-app.ts` — `registry.register(new SerpApiAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"serpapi"` to `ALLOWED_PROVIDERS`

**Create:**
- `tests/providers/serpapi-adapter.test.ts` — Unit tests (web, news, images)

**Extend:**
- `tests/routing/multi-provider-routing.test.ts` — 4-provider scenarios:
  - Every MVP capability covered by ≥2 providers
  - search.images fallback: Brave → SerpAPI
  - Per-project isolation: Project A uses Brave+Tavily, Project B uses Kagi+SerpAPI
  - Usage events correctly attribute provider across all combinations

### Task 50: SerpAPI dev seed and documentation [AC7]

**Modify:**
- `src/app/bootstrap.ts` — Add SerpAPI seed bindings (`SERPAPI_API_KEY` env var)
- `docs/debugging.md` — Add SerpAPI section, update provider matrix

**Final seed:**
```
search.web:    brave (0), kagi (1), tavily (2), serpapi (3)
search.news:   brave (0), kagi (1), serpapi (2)
search.images: brave (0), serpapi (1)
```

---

## Phase 4D: Operator Console Multi-Provider Support

### Task 51: Backend — provider stats endpoint [AC3][AC6]

**Create new endpoint:**
- `GET /v1/admin/stats/providers` — Returns per-provider request breakdown

**Response:**
```json
{
  "providers": [
    { "provider": "brave", "requestCount": 500, "successCount": 480, "failureCount": 20, "avgLatencyMs": 120 },
    { "provider": "tavily", "requestCount": 100, "successCount": 98, "failureCount": 2, "avgLatencyMs": 85 }
  ]
}
```

**Modify:**
- `src/modules/admin/service/admin-service.ts` — Add `getProviderBreakdown(filters)` method
- `src/modules/admin/http/routes.ts` — Register `GET /v1/admin/stats/providers`
- `src/infra/db/repositories/usage-event-repository.ts` — Add `perProviderStats(filters)` query

**Create:**
- `tests/admin/provider-stats-routes.test.ts` — Tests for new endpoint

### Task 52: Backend — registered providers list endpoint [AC6]

**Create new endpoint:**
- `GET /v1/admin/providers` — Returns all registered providers with capabilities and health

**Response:**
```json
{
  "providers": [
    { "id": "brave", "capabilities": ["search.web", "search.news", "search.images"], "health": "healthy" },
    { "id": "tavily", "capabilities": ["search.web"], "health": "unavailable" },
    { "id": "kagi", "capabilities": ["search.web", "search.news"], "health": "healthy" },
    { "id": "serpapi", "capabilities": ["search.web", "search.news", "search.images"], "health": "degraded" }
  ]
}
```

**Modify:**
- `src/modules/admin/http/routes.ts` — Register route
- Wire `ProviderRegistry` and `HealthService` into admin route deps

**Create:**
- Tests in `tests/admin/provider-stats-routes.test.ts`

### Task 53: Frontend — Project Detail multi-provider support [AC5][AC6]

Currently the Project Detail page (`frontend/src/routes/projects/ProjectDetail.tsx`) is
hardcoded to Brave — credential form says "Brave API secret", binding form only offers
`provider: "brave"`, priority is hardcoded to 0.

**Changes:**
- **Credential section:** Add provider selector dropdown (populated from `GET /v1/admin/providers`). Show per-provider credential status. Allow attaching credentials for any registered provider.
- **Binding section:** Add provider selector to binding form. Show priority field as editable number input. Allow configuring bindings for any provider × capability combination.
- **Binding table:** Show all bindings with enable/disable toggle and priority reordering.

**Modify:**
- `frontend/src/routes/projects/ProjectDetail.tsx` — Multi-provider credential and binding UI
- `frontend/src/lib/api.ts` — Add `listProviders()` API call

### Task 54: Frontend — Dashboard provider breakdown chart [AC6]

**Changes to Dashboard (`frontend/src/routes/dashboard/Dashboard.tsx`):**
- Add "Requests by Provider" section below the existing capability breakdown
- Fetch data from `GET /v1/admin/stats/providers`
- Display horizontal bar chart (same style as capability breakdown) showing request count per provider
- Respect the existing project filter — pass `projectId` to provider stats endpoint

**Modify:**
- `frontend/src/routes/dashboard/Dashboard.tsx` — Add provider breakdown section
- `frontend/src/lib/api.ts` — Add `getProviderBreakdown()` API call

### Task 55: Frontend — Usage page provider filter [AC6]

**Changes to UsagePage (`frontend/src/routes/usage/UsagePage.tsx`):**
- Add provider filter dropdown (populated dynamically from `GET /v1/admin/providers`)
- Pass `provider` param to usage query endpoint
- CSV export includes provider column (already present in data)

**Modify:**
- `frontend/src/routes/usage/UsagePage.tsx` — Add provider filter select
- `frontend/src/lib/api.ts` — Add `listProviders()` if not added in Task 53

### Task 56: Frontend — Providers page (new) [AC6]

**Create new page at `/providers`:**
- Shows all registered providers as cards
- Each card: provider name, supported capabilities (badges), health status (StatusBadge), latency
- Health data from `GET /v1/health/providers` (already exists)
- Provider list from `GET /v1/admin/providers` (added in Task 52)

**Create:**
- `frontend/src/routes/providers/ProvidersPage.tsx`

**Modify:**
- `frontend/src/app/App.tsx` — Add `/providers` route
- `frontend/src/components/layout/Shell.tsx` — Add "Providers" nav item

### Task 57: Frontend tests for multi-provider pages [AC6][AC7]

**Create:**
- `frontend/src/__tests__/multi-provider.test.tsx` — Tests for:
  - ProvidersPage renders provider cards with health status
  - Dashboard shows provider breakdown section
  - UsagePage has provider filter dropdown
  - ProjectDetail shows multi-provider credential form and binding controls

**Modify:**
- `frontend/src/__tests__/new-pages.test.tsx` — Update Dashboard tests for provider breakdown

---

## Phase 4E: End-to-End Validation

### Task 58: Multi-provider E2E integration test [AC2][AC3][AC4]

**Create:**
- `tests/e2e/multi-provider-wiring.test.ts`

**Scenarios:**
1. Boot with 4 registered providers (mocked HTTP)
2. `POST /v1/search/web` → routes to default provider
3. Default provider returns 503 → fallback to next in chain
4. Explicit `provider: "serpapi"` → routes to SerpAPI
5. Disable provider binding via admin API → excluded from routing
6. Usage events correctly attribute provider for each request
7. Health endpoint shows status for all 4 providers
8. Provider stats endpoint aggregates correctly

### Task 59: Final documentation and validation [AC7]

**Modify:**
- `docs/debugging.md` — Final provider matrix, all env vars, complete endpoint reference
- `docs/plans/2026-03-21-seekapi-phase-4-multi-provider-expansion-plan.md` — Mark completed

**Verify:**
- `bash scripts/validate.sh` passes
- Architecture checks pass (no transport→repository violations)
- AC coverage checks pass (all AC tags have evidence)
- Smoke test passes

---

## Execution Order and Dependencies

```
Phase 4A: Tavily
  Task 41: Adapter impl               ← standalone
  Task 42: Registration + unit tests   ← depends on 41
  Task 43: 2-provider routing tests    ← depends on 42
  Task 44: Seed + docs                 ← depends on 42

Phase 4B: Kagi
  Task 45: Adapter impl               ← standalone (can parallel with 4A tasks)
  Task 46: Registration + routing      ← depends on 45, 43
  Task 47: Seed + docs                 ← depends on 46

Phase 4C: SerpAPI
  Task 48: Adapter impl               ← standalone (can parallel with 4B tasks)
  Task 49: Registration + routing      ← depends on 48, 46
  Task 50: Seed + docs                 ← depends on 49

Phase 4D: Operator Console
  Task 51: Provider stats endpoint     ← depends on 49 (all providers registered)
  Task 52: Providers list endpoint     ← depends on 49
  Task 53: ProjectDetail multi-prov    ← depends on 52
  Task 54: Dashboard provider chart    ← depends on 51
  Task 55: Usage page provider filter  ← depends on 52
  Task 56: Providers page (new)        ← depends on 52
  Task 57: Frontend tests              ← depends on 53-56

Phase 4E: Validation
  Task 58: E2E integration test        ← depends on 49
  Task 59: Final docs + validation     ← depends on all
```

**Parallelization:** Adapter implementations (41, 45, 48) are independent.
Phase 4D tasks 53-56 are independent of each other once 51-52 are done.

---

## Files Changed Summary

### New files (by provider)

| Provider | Files |
|----------|-------|
| Tavily | `src/providers/tavily/{schemas,client,mapper,adapter}.ts`, `tests/providers/tavily-adapter.test.ts` |
| Kagi | `src/providers/kagi/{schemas,client,mapper,adapter}.ts`, `tests/providers/kagi-adapter.test.ts` |
| SerpAPI | `src/providers/serpapi/{schemas,client,mapper,adapter}.ts`, `tests/providers/serpapi-adapter.test.ts` |

### New files (shared)

| File | Purpose |
|------|---------|
| `tests/routing/multi-provider-routing.test.ts` | Cross-provider routing integration |
| `tests/e2e/multi-provider-wiring.test.ts` | Full lifecycle E2E test |
| `tests/admin/provider-stats-routes.test.ts` | Provider stats endpoint tests |
| `frontend/src/routes/providers/ProvidersPage.tsx` | New Providers page |
| `frontend/src/__tests__/multi-provider.test.tsx` | Multi-provider frontend tests |

### Modified files

| File | Change |
|------|--------|
| `src/app/build-app.ts` | Register 3 new adapters |
| `src/app/bootstrap.ts` | Add seed bindings and credentials for 3 providers |
| `src/modules/admin/service/admin-service.ts` | Expand `ALLOWED_PROVIDERS` |
| `src/modules/admin/http/routes.ts` | Add provider stats + list endpoints |
| `src/infra/db/repositories/usage-event-repository.ts` | Add `perProviderStats()` query |
| `frontend/src/app/App.tsx` | Add `/providers` route |
| `frontend/src/components/layout/Shell.tsx` | Add "Providers" nav item |
| `frontend/src/lib/api.ts` | Add `listProviders()`, `getProviderBreakdown()` |
| `frontend/src/routes/projects/ProjectDetail.tsx` | Multi-provider credential/binding UI |
| `frontend/src/routes/dashboard/Dashboard.tsx` | Add provider breakdown section |
| `frontend/src/routes/usage/UsagePage.tsx` | Add provider filter |
| `docs/debugging.md` | Full multi-provider docs |

---

## Architecture Fence Compliance

| Rule | How this plan complies |
|------|----------------------|
| Transport → Repository banned | All new endpoints call service methods, not repositories [AC4] |
| Service → HTTP response banned | Adapter/service return domain types; routes shape HTTP responses [AC4] |
| Provider schemas internal only | Each provider's `schemas.ts` is only imported within its own directory [AC4] |
| Canonical routes provider-neutral | No changes to `/v1/search/*` routes — same paths, same schemas [AC4] |
| Secrets encrypted at rest | Same AES-256-GCM encryption via `CredentialService` for all providers |
| Frontend → HTTP only | Console calls admin/health endpoints; no direct DB/Redis access [AC6] |
| `validate.sh` delivery gate | Required to pass after each sub-phase [AC7] |
| AC coverage check | Every AC tag appears in tests or implementation [AC7] |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Provider API changes | Adapter isolation — changes contained to `src/providers/<name>/` |
| Rate limiting during tests | All provider HTTP calls mocked; real calls only in manual smoke |
| Credential leakage | Same AES-256-GCM as Brave; secrets never logged |
| Inconsistent response quality | Canonical normalization; per-adapter mapping tests |
| Routing complexity at 4 providers | Routing service already handles N providers; tests prove determinism |
| Frontend hardcoded to Brave | Task 53 explicitly removes Brave hardcoding from ProjectDetail |

---

## Success Criteria

Phase 4 is complete when:

1. 4 providers registered (Brave, Tavily, Kagi, SerpAPI) [AC1]
2. All 3 MVP capabilities covered by ≥2 providers [AC1]
3. Fallback works across any provider combination [AC2]
4. Per-project, per-capability routing configurable via admin API and console [AC5]
5. Usage/audit/metrics correctly attribute provider [AC3]
6. No canonical route changes [AC4]
7. Operator console shows providers, per-provider stats, multi-provider bindings [AC6]
8. `bash scripts/validate.sh` passes with all new tests [AC7]

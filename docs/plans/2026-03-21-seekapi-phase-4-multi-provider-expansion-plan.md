# Phase 4: Multi-Provider Expansion Plan

> **Goal:** Expand SeekAPI from a Brave-only gateway to a true multi-provider
> search dispatcher by adding Tavily, Kagi, and SerpAPI — validating that the
> canonical API, routing, fallback, and observability layers are genuinely
> provider-neutral.

## Overview

| Sub-phase | Provider | Capabilities | Key Validation |
|-----------|----------|-------------|----------------|
| **4A** | Tavily | search.web | 2-provider routing & fallback |
| **4B** | Kagi | search.web, search.news | 3-provider policy, per-capability routing |
| **4C** | SerpAPI | search.web, search.news, search.images | Full parity, all capabilities covered by 2+ providers |

**Architecture invariant:** No canonical route, search service, or usage/audit
layer needs modification. All changes are confined to:
- `src/providers/<name>/` (new adapter code)
- `src/modules/admin/service/admin-service.ts` (ALLOWED_PROVIDERS allowlist)
- `src/app/build-app.ts` (registry registration)
- `src/app/bootstrap.ts` (dev seed data)
- `tests/` (new and extended tests)
- `docs/` (operator docs)

**Delivery gate:** `bash scripts/validate.sh` must pass after each sub-phase.

---

## Phase 4A: Tavily Adapter

**Why first:** Tavily's API is the closest fit to the canonical search model —
single endpoint, JSON in/out, built-in answer extraction. Lowest mapping
friction makes it ideal for validating the multi-provider wiring.

### Tavily API Reference

| Item | Value |
|------|-------|
| Base URL | `https://api.tavily.com` |
| Auth | `api_key` field in request body (or `Authorization: Bearer`) |
| Search endpoint | `POST /search` |
| Capabilities | Web search (primary), with optional `topic: "news"` for news-like results |

**Request shape:**
```json
{
  "api_key": "<key>",
  "query": "...",
  "search_depth": "basic" | "advanced",
  "max_results": 5,
  "include_answer": true,
  "include_domains": ["example.com"],
  "exclude_domains": ["spam.com"],
  "topic": "general" | "news"
}
```

**Response shape:**
```json
{
  "query": "...",
  "answer": "AI-generated answer...",
  "results": [
    {
      "title": "...",
      "url": "...",
      "content": "...",
      "score": 0.95,
      "published_date": "2026-03-21"
    }
  ]
}
```

### Tasks

#### Task 41: Tavily adapter implementation

**Files to create:**
- `src/providers/tavily/schemas.ts` — Tavily-specific request/response types
- `src/providers/tavily/client.ts` — HTTP client with error categorization
- `src/providers/tavily/mapper.ts` — Canonical ↔ Tavily mapping
- `src/providers/tavily/adapter.ts` — `TavilyAdapter implements ProviderAdapter`

**Adapter contract:**
```typescript
class TavilyAdapter implements ProviderAdapter {
  readonly id = "tavily";
  supportedCapabilities() { return ["search.web"]; }
  // credential: Tavily API key string
  // execute: map canonical → POST /search → map response
  // healthCheck: lightweight search with 5s timeout
}
```

**Mapping rules:**
| Canonical | Tavily |
|-----------|--------|
| `query` | `query` |
| `maxResults` | `max_results` (default 5, max 20) |
| `includeDomains` | `include_domains` |
| `excludeDomains` | `exclude_domains` |
| `timeRange` | Not directly supported; pass through or ignore |
| `country` / `locale` | Not supported; ignore |
| Response `content` | Map to `snippet` |
| Response `score` | Map to `score` |
| Response `published_date` | Map to `publishedAt` |
| Response `answer` | Map to `answer` field in CanonicalSearchResponse |

**Error categorization:**
| Tavily HTTP status | ProviderError category |
|--------------------|----------------------|
| 401 / 403 | `bad_credential` |
| 429 | `rate_limited` |
| 5xx | `upstream_5xx` |
| Network error | `timeout` |

**AC:** TavilyAdapter passes unit tests equivalent to BraveAdapter test coverage.

#### Task 42: Tavily registration and allowlist

**Files to modify:**
- `src/app/build-app.ts` — `registry.register(new TavilyAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"tavily"` to `ALLOWED_PROVIDERS`

**AC:** Tavily adapter is instantiated and available in the registry at boot.

#### Task 43: Two-provider routing and fallback tests

**Files to create/modify:**
- `tests/providers/tavily-adapter.test.ts` — Unit tests (schema mapping, error handling, health probe)
- `tests/routing/multi-provider-routing.test.ts` — Integration tests proving:
  - Default provider selection respects project binding
  - Fallback from Brave → Tavily on retryable error
  - Fallback from Tavily → Brave on retryable error
  - Explicit `provider: "tavily"` in request body routes correctly
  - Health-aware exclusion works across both providers
  - Usage events record correct provider for each attempt

**AC:** All routing tests pass with 2-provider configurations. Fallback is deterministic.

#### Task 44: Dev seed and operator documentation

**Files to modify:**
- `src/app/bootstrap.ts` — Add Tavily seed bindings and credential (from `TAVILY_API_KEY` env var)
- `docs/debugging.md` — Add Tavily endpoints, env vars, and troubleshooting

**Seed config:**
```typescript
bindings: [
  { provider: "brave",  capability: "search.web", enabled: true, priority: 0 },
  { provider: "tavily", capability: "search.web", enabled: true, priority: 1 },
]
// Brave is default, Tavily is fallback for search.web
```

**AC:** `TAVILY_API_KEY=xxx pnpm start` boots with both providers available.
Operator can attach Tavily credentials via admin API and route requests to it.

---

## Phase 4B: Kagi Adapter

**Why second:** Kagi supports both web and news search, which tests
per-capability routing — a project can use Brave for images but Kagi for web.

### Kagi API Reference

| Item | Value |
|------|-------|
| Base URL | `https://kagi.com/api/v0` |
| Auth | `Authorization: Bot <token>` |
| Search endpoint | `GET /search?q=...` |
| Capabilities | Web search, news (via result filtering) |

**Request (query params):**
```
GET /search?q=<query>&limit=<n>
```

**Response shape:**
```json
{
  "meta": { "id": "...", "node": "...", "ms": 123 },
  "data": [
    {
      "t": 0,
      "rank": 1,
      "url": "https://...",
      "title": "...",
      "snippet": "...",
      "published": "2026-03-21T..."
    }
  ]
}
```

Result types: `t=0` = organic web result, `t=1` = news result.

### Tasks

#### Task 45: Kagi adapter implementation

**Files to create:**
- `src/providers/kagi/schemas.ts` — Kagi-specific types
- `src/providers/kagi/client.ts` — HTTP client (`GET` with query params, `Bot` auth header)
- `src/providers/kagi/mapper.ts` — Canonical ↔ Kagi mapping
- `src/providers/kagi/adapter.ts` — `KagiAdapter implements ProviderAdapter`

**Adapter contract:**
```typescript
class KagiAdapter implements ProviderAdapter {
  readonly id = "kagi";
  supportedCapabilities() { return ["search.web", "search.news"]; }
}
```

**Mapping rules:**
| Canonical | Kagi |
|-----------|------|
| `query` | `q` query param |
| `maxResults` | `limit` query param |
| `timeRange` | Not directly supported |
| `includeDomains` / `excludeDomains` | Append to query string (e.g., `site:example.com`) |
| Response `t=0` items | Map to web results |
| Response `t=1` items | Map to news results |
| Response `meta.ms` | Map to `latencyMs` |

**Capability routing:**
- `search.web`: Return `t=0` results
- `search.news`: Return `t=1` results (filter from same endpoint)

**Error categorization:**
| Kagi HTTP status | ProviderError category |
|-----------------|----------------------|
| 401 | `bad_credential` |
| 429 | `rate_limited` |
| 5xx | `upstream_5xx` |

**AC:** KagiAdapter passes unit tests for both web and news capabilities.

#### Task 46: Kagi registration and 3-provider routing tests

**Files to modify:**
- `src/app/build-app.ts` — `registry.register(new KagiAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"kagi"` to `ALLOWED_PROVIDERS`

**Files to create/modify:**
- `tests/providers/kagi-adapter.test.ts` — Unit tests
- `tests/routing/multi-provider-routing.test.ts` — Extend with 3-provider scenarios:
  - Per-capability default: Brave for images, Kagi for web, Tavily as fallback
  - Fallback chain: Kagi → Brave → Tavily for search.web
  - Provider health exclusion with 3 providers
  - Registry `byCapability()` returns correct adapters per capability

**AC:** 3-provider routing is deterministic. Per-capability policy works correctly.

#### Task 47: Kagi dev seed and documentation

**Files to modify:**
- `src/app/bootstrap.ts` — Add Kagi seed bindings (`KAGI_API_KEY` env var)
- `docs/debugging.md` — Add Kagi section

**Seed config:**
```typescript
bindings: [
  // search.web: Brave default, Kagi fallback, Tavily fallback
  { provider: "brave",  capability: "search.web",    enabled: true, priority: 0 },
  { provider: "kagi",   capability: "search.web",    enabled: true, priority: 1 },
  { provider: "tavily", capability: "search.web",    enabled: true, priority: 2 },
  // search.news: Brave default, Kagi fallback
  { provider: "brave",  capability: "search.news",   enabled: true, priority: 0 },
  { provider: "kagi",   capability: "search.news",   enabled: true, priority: 1 },
  // search.images: Brave only
  { provider: "brave",  capability: "search.images",  enabled: true, priority: 0 },
]
```

**AC:** Operator can configure per-capability routing across 3 providers.

---

## Phase 4C: SerpAPI Adapter

**Why third:** SerpAPI wraps Google/Bing and supports all three MVP capabilities
(web, news, images), completing full capability coverage with 2+ providers per
capability. Also validates the `options` pass-through for engine selection.

### SerpAPI Reference

| Item | Value |
|------|-------|
| Base URL | `https://serpapi.com` |
| Auth | `api_key` query param |
| Search endpoint | `GET /search?engine=google&q=...&api_key=...` |
| Capabilities | Web, news, images (via `tbm` param) |

**Request (query params):**
```
GET /search?engine=google&q=<query>&api_key=<key>&num=<n>
    &tbm=         (web, default)
    &tbm=nws      (news)
    &tbm=isch     (images)
```

**Response shape (web):**
```json
{
  "search_metadata": { "total_time_taken": 1.23 },
  "organic_results": [
    {
      "position": 1,
      "title": "...",
      "link": "https://...",
      "snippet": "...",
      "date": "3 days ago"
    }
  ]
}
```

**Response shape (news — `tbm=nws`):**
```json
{
  "news_results": [
    {
      "position": 1,
      "title": "...",
      "link": "https://...",
      "snippet": "...",
      "date": "2 hours ago",
      "source": "Reuters"
    }
  ]
}
```

**Response shape (images — `tbm=isch`):**
```json
{
  "images_results": [
    {
      "position": 1,
      "title": "...",
      "original": "https://...",
      "thumbnail": "https://...",
      "source": "example.com"
    }
  ]
}
```

### Tasks

#### Task 48: SerpAPI adapter implementation

**Files to create:**
- `src/providers/serpapi/schemas.ts` — SerpAPI-specific types (web, news, images)
- `src/providers/serpapi/client.ts` — HTTP client (`GET` with query params)
- `src/providers/serpapi/mapper.ts` — Canonical ↔ SerpAPI mapping (3 capabilities)
- `src/providers/serpapi/adapter.ts` — `SerpApiAdapter implements ProviderAdapter`

**Adapter contract:**
```typescript
class SerpApiAdapter implements ProviderAdapter {
  readonly id = "serpapi";
  supportedCapabilities() {
    return ["search.web", "search.news", "search.images"];
  }
}
```

**Mapping rules:**
| Canonical | SerpAPI |
|-----------|---------|
| `query` | `q` |
| `maxResults` | `num` |
| `country` | `gl` (Google country code) |
| `locale` | `hl` (Google language code) |
| `timeRange: "day"` | `tbs=qdr:d` |
| `timeRange: "week"` | `tbs=qdr:w` |
| `timeRange: "month"` | `tbs=qdr:m` |
| `timeRange: "year"` | `tbs=qdr:y` |
| `includeDomains` | Append `site:` to query |
| `excludeDomains` | Append `-site:` to query |
| `options.engine` | `engine` param (default `"google"`) |
| Web: `organic_results[].link` | `url` |
| Web: `organic_results[].snippet` | `snippet` |
| News: `news_results[].link` | `url` |
| News: `news_results[].source` | `sourceType` |
| Images: `images_results[].original` | `url` |
| Images: `images_results[].thumbnail` | Map to `extensions.thumbnail` |

**Capability → request param mapping:**
| Capability | `tbm` param |
|-----------|-------------|
| `search.web` | (omit) |
| `search.news` | `nws` |
| `search.images` | `isch` |

**Error categorization:**
| SerpAPI HTTP status | ProviderError category |
|--------------------|----------------------|
| 401 / 403 | `bad_credential` |
| 429 | `rate_limited` |
| 5xx | `upstream_5xx` |

**AC:** SerpApiAdapter passes unit tests for all 3 capabilities.

#### Task 49: SerpAPI registration and full-coverage routing tests

**Files to modify:**
- `src/app/build-app.ts` — `registry.register(new SerpApiAdapter())`
- `src/modules/admin/service/admin-service.ts` — Add `"serpapi"` to `ALLOWED_PROVIDERS`

**Files to create/modify:**
- `tests/providers/serpapi-adapter.test.ts` — Unit tests (web, news, images)
- `tests/routing/multi-provider-routing.test.ts` — Extend with 4-provider scenarios:
  - Every MVP capability covered by at least 2 providers
  - Full fallback chain across 4 providers for search.web
  - search.images: Brave → SerpAPI fallback (only 2 support it)
  - Usage events correctly attribute provider across all combinations
  - Per-project policy isolation: Project A uses Brave+Tavily, Project B uses Kagi+SerpAPI

**Capability coverage matrix after Phase 4C:**

| Capability | Brave | Tavily | Kagi | SerpAPI |
|-----------|-------|--------|------|---------|
| search.web | ✅ | ✅ | ✅ | ✅ |
| search.news | ✅ | — | ✅ | ✅ |
| search.images | ✅ | — | — | ✅ |

**AC:** All MVP capabilities have at least 2 provider options. Routing tests
prove any combination works.

#### Task 50: SerpAPI dev seed and final documentation

**Files to modify:**
- `src/app/bootstrap.ts` — Add SerpAPI seed bindings (`SERPAPI_API_KEY` env var)
- `docs/debugging.md` — Add SerpAPI section, update provider matrix

**Final seed config:**
```typescript
bindings: [
  // search.web: 4 providers available
  { provider: "brave",   capability: "search.web",    enabled: true, priority: 0 },
  { provider: "kagi",    capability: "search.web",    enabled: true, priority: 1 },
  { provider: "tavily",  capability: "search.web",    enabled: true, priority: 2 },
  { provider: "serpapi",  capability: "search.web",    enabled: true, priority: 3 },
  // search.news: 3 providers
  { provider: "brave",   capability: "search.news",   enabled: true, priority: 0 },
  { provider: "kagi",    capability: "search.news",   enabled: true, priority: 1 },
  { provider: "serpapi",  capability: "search.news",   enabled: true, priority: 2 },
  // search.images: 2 providers
  { provider: "brave",   capability: "search.images",  enabled: true, priority: 0 },
  { provider: "serpapi",  capability: "search.images",  enabled: true, priority: 1 },
]
```

**AC:** Full multi-provider documentation. Operator can independently configure
any combination of providers per project per capability.

---

## Phase 4D: Operator console multi-provider support

#### Task 51: Frontend provider management enhancements

**Changes needed:**
- **Dashboard**: Provider breakdown chart (requests per provider)
- **Keys page**: No changes needed (provider-agnostic)
- **Usage page**: Add provider filter dropdown (dynamic from backend)
- **Subscriptions page**: No changes needed (provider-agnostic)
- **Project detail page**: Show provider bindings with priority ordering, allow
  reordering and toggling per-provider per-capability

**AC:** Operator console reflects multi-provider reality. Dashboard shows
per-provider stats, usage page filters by provider, project detail shows
binding configuration.

#### Task 52: End-to-end multi-provider smoke test

**Files to create:**
- `tests/e2e/multi-provider-wiring.test.ts`

**Test scenarios:**
1. Boot with 4 registered providers (mocked HTTP for each)
2. Send search.web request → routed to default provider
3. Default provider returns 503 → fallback to next in chain
4. Explicit `provider: "serpapi"` → routes to SerpAPI
5. Disable provider binding via admin API → excluded from routing
6. Usage events show correct provider attribution for each request
7. Health endpoint shows status for all 4 providers

**AC:** Single integration test proves the entire multi-provider lifecycle.

---

## Execution Order & Dependencies

```
Phase 4A (Tavily)
  Task 41: Adapter impl          ← standalone
  Task 42: Registration          ← depends on 41
  Task 43: 2-provider routing    ← depends on 42
  Task 44: Seed & docs           ← depends on 42

Phase 4B (Kagi)
  Task 45: Adapter impl          ← standalone (can parallel with 4A)
  Task 46: Registration + tests  ← depends on 45, 43
  Task 47: Seed & docs           ← depends on 46

Phase 4C (SerpAPI)
  Task 48: Adapter impl          ← standalone (can parallel with 4B)
  Task 49: Registration + tests  ← depends on 48, 46
  Task 50: Seed & docs           ← depends on 49

Phase 4D (Frontend + E2E)
  Task 51: Console enhancements  ← depends on 49
  Task 52: E2E smoke test        ← depends on 49
```

**Parallelization opportunity:** Adapter implementations (41, 45, 48) are
independent and can be developed in parallel. Registration and routing tests
must be sequential to validate incremental provider additions.

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Provider API changes | Adapter isolation — changes contained to `src/providers/<name>/` |
| Rate limiting during tests | All provider HTTP calls mocked in unit tests; real calls only in manual smoke |
| Credential leakage | Same AES-256-GCM encryption as Brave; never log raw secrets |
| Inconsistent response quality | Canonical response normalization; tests verify mapping correctness |
| Routing complexity at 4 providers | Routing service already handles N providers; tests prove determinism |
| Provider downtime | Health probes + fallback chain; degraded provider excluded from routing |

---

## Success Criteria

Phase 4 is complete when:

1. **4 providers registered** (Brave, Tavily, Kagi, SerpAPI)
2. **All 3 MVP capabilities** covered by at least 2 providers
3. **Fallback works** across any provider combination
4. **Per-project, per-capability routing** is configurable via admin API
5. **Usage/audit/metrics** correctly attribute provider for every request
6. **No canonical route changes** — same API for downstream consumers
7. **`bash scripts/validate.sh` passes** with all new tests
8. **Operator console** shows multi-provider stats and configuration

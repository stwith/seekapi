# SeekAPI Phase 3.5 Frontend Enhancement Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the operator console from a minimal functional prototype to a polished, production-grade management interface with dashboard analytics, API key lifecycle management, usage records, and subscription/quota management.

**Context:** Phase 3 delivered a working operator console with basic project/key/binding/credential management and a flow runner. The UI uses inline styles, has no design system, and lacks usage visibility. This phase adds the missing operational surfaces and modernizes the UI stack — borrowing layout and interaction patterns from sub2api's Vue frontend, adapted to our React + TypeScript stack.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS (new), Recharts (new), React Router DOM 7, Vitest

---

## Acceptance Criteria

AC1: The frontend uses Tailwind CSS as the styling foundation. All existing inline-style components are migrated. The UI supports a dark sidebar layout with a responsive shell.

AC2: A Dashboard page shows real-time operational stats: total requests, success rate, average latency, active keys count, and request trend charts (by hour/day), with project-scoped filtering.

AC3: An API Keys page provides full key lifecycle management: list with status/creation date/last used, mint with reveal-once display, disable, per-key usage summary, and copy-to-clipboard.

AC4: A Usage Records page shows paginated request history with filtering by project, key, capability, status, and date range. Each row displays timestamp, capability, provider, status code, latency, result count, and fallback info. Supports CSV export.

AC5: A Subscription/Quota management page shows per-project resource quotas (request limits, key limits), progress bars for usage against limits, and CRUD for quota policies.

AC6: The backend exposes the minimum additional read endpoints to support the new frontend surfaces: usage event queries (with filtering and aggregation), audit log queries, key usage summaries, and dashboard stats aggregation. No raw secrets are ever exposed.

AC7: All new frontend and backend changes pass `bash scripts/validate.sh`. New components have unit tests. New endpoints have route tests.

## Constraints

- Keep admin-key auth for this phase. Do not add user login/registration.
- Do not add personal profile or redemption/coupon features.
- Do not add billing or payment processing.
- Do not access persistence from transport handlers directly.
- Preserve all existing Phase 3 functionality — Flow Runner, project CRUD, credential/binding management remain unchanged.
- Keep Brave as the only provider in this phase.

## Non-Goals

- User self-service registration / login
- Personal profile management
- Redemption codes / coupons
- Payment / billing integration
- i18n / multi-language
- Mobile-first responsive design (desktop-first is sufficient)
- Real-time WebSocket push for live stats

## Validation Commands

Every task must pass:

```bash
bash scripts/validate.sh
```

Phase-specific:

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
```

---

## Task Breakdown

### Task 32: Introduce Tailwind CSS and design system foundation

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`
- Modify: `frontend/src/style.css` → global Tailwind directives
- Create: `frontend/src/components/ui/StatCard.tsx`
- Create: `frontend/src/components/ui/DataTable.tsx`
- Create: `frontend/src/components/ui/Modal.tsx`
- Create: `frontend/src/components/ui/Pagination.tsx`
- Create: `frontend/src/components/ui/StatusBadge.tsx`
- Create: `frontend/src/components/ui/EmptyState.tsx`
- Create: `frontend/src/components/ui/LoadingSpinner.tsx`
- Create: `frontend/src/components/ui/DateRangePicker.tsx`
- Test: `frontend/src/__tests__/ui-components.test.tsx`

**Description:**

Install Tailwind CSS, PostCSS, and autoprefixer. Configure dark mode (class strategy) and a custom color palette inspired by sub2api's teal/primary scheme adapted to SeekAPI's brand.

Build the shared UI component library:

- **StatCard** — metric card with label, value, optional change indicator and icon. Support colored accent borders (blue, green, purple, orange).
- **DataTable** — generic table with column definitions, sortable headers, row rendering slots, and responsive overflow.
- **Modal** — overlay dialog with title, body slot, close button, and backdrop click dismiss.
- **Pagination** — page number buttons + page size selector + total count display.
- **StatusBadge** — colored pill badge for statuses (active/disabled/error/pending).
- **EmptyState** — centered icon + message + optional action button.
- **LoadingSpinner** — animated spinner with optional label.
- **DateRangePicker** — preset date range buttons (Today, 7d, 30d, Custom) with start/end date inputs.

**Step 1:** Write tests for each UI component (renders, props, click handlers).
**Step 2:** Run tests — expect FAIL.
**Step 3:** Install Tailwind, configure, implement components.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 33: Migrate Shell, LoginGate, and existing pages to Tailwind

**Files:**
- Modify: `frontend/src/components/layout/Shell.tsx`
- Modify: `frontend/src/app/App.tsx` (LoginGate)
- Modify: `frontend/src/routes/overview/Overview.tsx`
- Modify: `frontend/src/routes/projects/ProjectList.tsx`
- Modify: `frontend/src/routes/projects/ProjectDetail.tsx`
- Modify: `frontend/src/routes/flow-runner/FlowRunner.tsx`
- Test: update existing tests as needed

**Description:**

Migrate all existing components from inline styles to Tailwind classes. Redesign the shell layout:

- **Sidebar:** Dark background (`bg-gray-900`), 240px width, SeekAPI logo area, icon + label nav items with active state highlight, collapsible on smaller screens, logout button at bottom.
- **Header:** Optional top bar with breadcrumb, project selector, and admin indicator.
- **LoginGate:** Centered card with gradient background, terminal-style decoration (inspired by sub2api's home page), branded look.
- **Nav items (updated):**
  1. Dashboard (new — `/`)
  2. Projects (`/projects`)
  3. API Keys (new — `/keys`)
  4. Usage Records (new — `/usage`)
  5. Subscriptions (new — `/subscriptions`)
  6. Flow Runner (`/flow-runner`)

Preserve all existing functionality — this is a visual-only migration.

**Step 1:** Update existing tests for new class-based rendering.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Migrate components.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 34: Backend — usage query and dashboard stats endpoints

**Files:**
- Modify: `src/modules/admin/http/routes.ts`
- Modify: `src/modules/admin/service/admin-service.ts`
- Modify: `src/infra/db/repositories/usage-event-repository.ts`
- Modify: `src/infra/db/repositories/audit-log-repository.ts`
- Modify: `src/infra/db/repositories/api-key-repository.ts`
- Test: `tests/admin/admin-stats-routes.test.ts`

**Description:**

Add admin read endpoints for dashboard and usage data:

**New repository methods:**

`UsageEventRepository`:
- `query(filters)` → paginated usage events with optional filters: projectId, apiKeyId, capability, success, dateFrom, dateTo. Returns `{ items, total }`.
- `aggregateStats(filters)` → returns: totalRequests, successCount, failureCount, avgLatencyMs, p95LatencyMs for the given filter window.
- `timeSeries(filters, granularity)` → returns request counts grouped by hour or day.
- `topCapabilities(filters, limit)` → top capabilities by request count.
- `perKeyStats(projectId)` → per-key request count and last-used time.

`AuditLogRepository`:
- `query(filters)` → paginated audit log entries with optional filters: projectId, action, dateFrom, dateTo.

`ApiKeyRepository`:
- `countByProject(projectId)` → total and active key counts.

**New admin endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/admin/usage` | Query usage events (paginated, filterable) |
| GET | `/v1/admin/stats/dashboard` | Aggregated dashboard stats |
| GET | `/v1/admin/stats/timeseries` | Time series data for charts |
| GET | `/v1/admin/stats/capabilities` | Top capabilities breakdown |
| GET | `/v1/admin/projects/:projectId/keys/stats` | Per-key usage stats for a project |
| GET | `/v1/admin/audit` | Query audit log entries (paginated, filterable) |

**Query parameters (usage / stats):**
- `projectId` (optional UUID)
- `apiKeyId` (optional UUID)
- `capability` (optional string)
- `success` (optional boolean)
- `from` (optional ISO date)
- `to` (optional ISO date)
- `page` (default 1)
- `pageSize` (default 50, max 200)
- `granularity` (hour | day, for timeseries)

**Step 1:** Write route tests for each endpoint.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Implement repository methods (in-memory + Drizzle) and admin routes.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 35: Dashboard page

**Files:**
- Create: `frontend/src/routes/dashboard/Dashboard.tsx`
- Modify: `frontend/src/app/App.tsx` (add route)
- Modify: `frontend/src/lib/api.ts` (add dashboard API calls)
- Modify: `frontend/src/lib/types.ts`
- Test: `frontend/src/__tests__/dashboard.test.tsx`

**Description:**

Build the main Dashboard page (inspired by sub2api's admin dashboard):

**Top stats row (4 StatCards):**
1. **Total Requests** — total count with today's count as subtitle
2. **Success Rate** — percentage with colored indicator (green >95%, orange >80%, red ≤80%)
3. **Avg Latency** — milliseconds with P95 as subtitle
4. **Active Keys** — count with total keys as subtitle

**Charts section:**
- **Request Trend** — line/bar chart showing request volume over time. Granularity toggle (hourly / daily). Date range selector (Today, 7d, 30d, Custom).
- **Capability Distribution** — donut or horizontal bar chart showing request breakdown by capability (search.web, search.news, search.images).

**Bottom section:**
- **Recent Requests** — last 10 usage events in a compact table (time, capability, provider, status, latency).
- **Project filter** — optional dropdown to scope all dashboard data to a single project.

Use Recharts for chart rendering. All data fetched from the Task 34 endpoints.

**Step 1:** Write tests for Dashboard rendering, stat display, filter interaction.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Install recharts, implement Dashboard page and API calls.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 36: API Keys management page

**Files:**
- Create: `frontend/src/routes/keys/KeysPage.tsx`
- Modify: `frontend/src/app/App.tsx` (add route)
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/__tests__/keys-page.test.tsx`

**Description:**

Build a dedicated API Keys page (inspired by sub2api's KeysView):

**Top actions bar:**
- Project selector dropdown (filter keys by project)
- "Mint New Key" button (opens Modal)

**Mint Key Modal:**
- Select project from dropdown
- Optional key name/label input
- Submit → show reveal-once raw key display with copy button
- Warning text: "This key will only be shown once"
- Close dismisses and refreshes list

**Keys Table (DataTable):**

| Column | Content |
|--------|---------|
| Key ID | Truncated UUID with copy button |
| Project | Project name |
| Status | StatusBadge (active / disabled) |
| Requests | Total request count for this key |
| Last Used | Relative time ("2 hours ago") or "Never" |
| Created | Date |
| Actions | Disable button (with ConfirmDialog) |

**Features:**
- Search/filter by key ID or project
- Sort by columns
- Pagination
- Disable confirmation dialog
- Empty state when no keys exist

Data from existing admin endpoints + new per-key stats endpoint (Task 34).

**Step 1:** Write tests.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Implement.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 37: Usage Records page

**Files:**
- Create: `frontend/src/routes/usage/UsagePage.tsx`
- Modify: `frontend/src/app/App.tsx` (add route)
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/__tests__/usage-page.test.tsx`

**Description:**

Build a paginated, filterable usage records page (inspired by sub2api's UsageView):

**Filter bar:**
- Project selector (dropdown)
- API Key selector (dropdown, scoped to selected project)
- Capability filter (search.web / search.news / search.images / all)
- Status filter (success / failure / all)
- Date range picker (Today, 7d, 30d, Custom)
- Refresh button
- CSV Export button

**Stats summary row (4 mini StatCards above table):**
- Total requests (in current filter)
- Success count / failure count
- Average latency
- Total result count

**Usage Table (DataTable with Pagination):**

| Column | Content |
|--------|---------|
| Time | ISO timestamp, formatted |
| Capability | search.web, etc. |
| Provider | brave |
| Key ID | Truncated UUID |
| Status | StatusBadge: 200 (green) / 4xx (orange) / 5xx (red) |
| Latency | ms with color coding (<200ms green, <1s orange, >1s red) |
| Results | Count |
| Fallbacks | Count (show 0 as dash) |

**CSV Export:**
- Export current filtered view as CSV
- Sanitize values to prevent formula injection (prefix `=`, `+`, `-`, `@` with `'`)
- Use Blob download approach

**Step 1:** Write tests for filter interactions, table rendering, export.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Implement.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 38: Subscription / Quota management page

**Files:**
- Create: `frontend/src/routes/subscriptions/SubscriptionsPage.tsx`
- Modify: `frontend/src/app/App.tsx` (add route)
- Modify: `src/modules/admin/http/routes.ts` (quota endpoints)
- Modify: `src/modules/admin/service/admin-service.ts`
- Create: `src/infra/db/schema/project-quotas.ts`
- Modify: `src/infra/db/schema/index.ts`
- Create: `src/infra/db/repositories/quota-repository.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `tests/admin/quota-routes.test.ts`
- Test: `frontend/src/__tests__/subscriptions-page.test.tsx`

**Description:**

Add a project quota/subscription system and management UI (inspired by sub2api's SubscriptionsView).

**Backend — Quota schema:**

```
project_quotas table:
  id (UUID PK)
  projectId (UUID FK → projects, unique)
  dailyRequestLimit (int, nullable — null = unlimited)
  monthlyRequestLimit (int, nullable)
  maxKeys (int, default 10)
  rateLimitRpm (int, default 60)
  status (varchar: active / suspended)
  createdAt, updatedAt (timestamp)
```

**Backend — New endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/admin/projects/:projectId/quota` | Get project quota config + current usage |
| PUT | `/v1/admin/projects/:projectId/quota` | Create or update quota settings |
| GET | `/v1/admin/quotas` | List all project quotas with current usage |

The "current usage" is computed by counting usage_events for the current day/month window.

**Frontend — Subscriptions page:**

**Project Quota Cards grid:**
Each project displayed as a card containing:
- Project name and status badge
- **Daily limit:** progress bar (requests today / daily limit), percentage, color-coded (green <70%, orange 70-90%, red >90%)
- **Monthly limit:** progress bar (requests this month / monthly limit)
- **Keys:** current count / max keys
- **Rate limit:** RPM display
- **Actions:** Edit quota (opens modal), Suspend / Activate toggle

**Edit Quota Modal:**
- Daily request limit (number input, empty = unlimited)
- Monthly request limit (number input, empty = unlimited)
- Max keys (number input)
- Rate limit RPM (number input)
- Save / Cancel buttons

**Empty state:** "No quotas configured. Quotas help you control resource usage per project."

**Step 1:** Write backend + frontend tests.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Implement schema, repository, admin endpoints, and frontend page.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 39: Polish — responsive shell, loading states, error boundaries

**Files:**
- Modify: `frontend/src/components/layout/Shell.tsx`
- Create: `frontend/src/components/ui/ErrorBoundary.tsx`
- Create: `frontend/src/components/ui/ConfirmDialog.tsx`
- Create: `frontend/src/components/ui/Toast.tsx`
- Modify: various page components for consistent loading/error patterns
- Test: `frontend/src/__tests__/polish.test.tsx`

**Description:**

Final polish pass across all pages:

**Shell improvements:**
- Collapsible sidebar (hamburger toggle on narrow screens)
- Breadcrumb trail in header area
- Active nav item icon highlights

**Error handling:**
- React ErrorBoundary wrapper around route content — catches render errors and shows recovery UI
- Toast notification component for mutation feedback (key created, key disabled, quota saved, etc.)
- ConfirmDialog component for destructive actions (disable key, suspend project)

**Loading states:**
- Skeleton loading placeholders for StatCards and tables while data loads
- Consistent loading spinner placement across all pages

**Accessibility basics:**
- Focus management on modals (trap focus, close on Escape)
- ARIA labels on icon-only buttons
- Color contrast compliance for status badges

**Step 1:** Write tests for ErrorBoundary, Toast, ConfirmDialog.
**Step 2:** Run tests — expect FAIL.
**Step 3:** Implement and integrate across pages.
**Step 4:** Run tests — expect PASS.
**Step 5:** Commit.

---

### Task 40: Wire everything into validation and update docs

**Files:**
- Modify: `scripts/validate.sh`
- Modify: `frontend/package.json` (ensure all scripts work)
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `docs/plans/2026-03-20-local-dev-checklist.md`

**Description:**

Ensure all new frontend and backend code is covered by the delivery gate:

- `pnpm --dir frontend lint` passes
- `pnpm --dir frontend test` passes (all new test files)
- `pnpm --dir frontend build` produces production bundle
- `pnpm test` passes (all backend tests including new admin stats routes)
- Architecture checks pass
- Update README with new page descriptions
- Update local dev checklist with new UI walkthrough
- Document new admin API endpoints in debugging guide

**Step 1:** Run `bash scripts/validate.sh` and fix any failures.
**Step 2:** Update documentation.
**Step 3:** Final validation pass.
**Step 4:** Commit.

---

## Summary — What Sub2API Inspired vs What SeekAPI Adapts

| Sub2API Feature | SeekAPI Adaptation |
|----------------|-------------------|
| Vue + Tailwind + Pinia | React + Tailwind + local state (no Redux needed yet) |
| Admin Dashboard with StatCards + Charts | Same pattern, Recharts instead of Chart.js |
| KeysView with full CRUD + quotas | KeysPage with mint/disable + usage summary |
| UsageView with filters + export | UsagePage with same filter/export pattern |
| SubscriptionsView with progress bars | SubscriptionsPage adapted as quota management |
| Dark sidebar layout (AppSidebar) | Same Shell pattern, dark `bg-gray-900` sidebar |
| Terminal animation on home page | Adapted for LoginGate branding |
| DataTable + Pagination + Modal | Same component patterns, React implementations |
| Group/user model | Not applicable — we use project/key model |
| i18n (vue-i18n) | Skipped for this phase |
| Auth (JWT + OAuth) | Keep admin key auth for now |

## Handoff Notes

- This phase is UI-heavy. The backend changes are minimal — mostly read-only query endpoints and the new quota schema.
- All new backend endpoints remain admin-auth protected. No new auth model is introduced.
- The quota system is opt-in. Projects without quotas have unlimited access (existing behavior preserved).
- Recharts is chosen over Chart.js because it's React-native and tree-shakeable.
- Tailwind is introduced as the sole styling system — no CSS-in-JS or styled-components.
- If a task requires broader architectural changes, update `docs/architecture.md` before implementation.

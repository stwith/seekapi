# SeekAPI Phase 3 Operator Console Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal operator-facing frontend that manages and verifies the full Phase 2.5 Brave-only workflow through the existing admin and canonical APIs.

**Architecture:** Add a dedicated `frontend/` Next.js application that talks only to HTTP boundaries. Extend the admin module with read-oriented operator endpoints where necessary, but preserve the existing transport -> service -> repository layering and keep canonical search execution unchanged. The Next.js app is an operator console client, not a replacement backend.

**Tech Stack:** TypeScript, Node.js, Fastify, React, Next.js, Vitest, pnpm

---

## Acceptance Criteria

AC1: The repository contains a dedicated operator frontend application that can be started locally and configured against the SeekAPI server with `ADMIN_API_KEY`-based operator access.

AC2: The operator frontend exposes the Phase 2.5 control-plane surfaces needed for normal operation: project creation, Brave credential attach/rotate, Brave capability binding management, downstream key minting, and key disabling.

AC3: The operator frontend includes a guided or clearly sequenced workflow for the full Phase 2.5 flow: create project, bind Brave credential, enable `search.web`, mint two keys, run real searches, disable one key, and verify sibling-key isolation.

AC4: The backend exposes any required read-oriented operator endpoints without violating harness layering rules or leaking raw provider secrets.

AC5: The frontend and backend documentation show how to run the operator console locally and validate the full Brave-only workflow end to end.

AC6: `bash scripts/validate.sh` remains the delivery gate and covers the new frontend/backend changes through deterministic checks.

## Constraints

- Keep this phase operator-only; do not introduce tenant self-serve auth.
- Keep Brave as the only fully implemented upstream provider in this phase.
- Do not add billing, usage monetization, or account balances.
- Do not move provider-specific request knobs into canonical contracts.
- Do not access persistence directly from frontend-serving code or transport handlers.
- Keep downstream auth model unchanged: search traffic still authenticates with SeekAPI API keys.
- Preserve `bash scripts/validate.sh` as the delivery gate.

## Non-Goals

- Multi-provider routing UI
- End-user login or registration
- Billing and quota purchasing
- Deep analytics dashboards
- Replacing admin API automation scripts entirely
- SSR or a full-stack framework migration

## Validation Commands

Every task in this phase must continue to pass:

```bash
bash scripts/validate.sh
```

Phase-specific validation should also include:

```bash
pnpm --dir frontend test
pnpm --dir frontend lint
pnpm --dir frontend build
```

Manual validation should prove the full Phase 2.5 flow from the UI against a running local server.

### Task 26: Define frontend package and operator runtime contract

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.*`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/page.tsx`
- Create: `frontend/app/*`
- Create: `frontend/src/*`
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Write the frontend bootstrap tests**

Create a minimal app-shell test that proves the frontend renders an operator layout and reads configured API base URL values.

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test`
Expected: FAIL because the frontend app and test setup do not exist yet.

**Step 3: Write minimal frontend bootstrap**

Create the `frontend/` Next.js app with:

- App Router entrypoint
- operator app shell
- route groups or top-level app routes
- environment contract for API base URL

**Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test`
Expected: PASS for the app-shell bootstrap test.

**Step 5: Commit**

```bash
git add frontend package.json README.md
git commit -m "feat: add operator frontend bootstrap"
```

### Task 27: Add operator read endpoints for UI data loading

**Files:**
- Modify: `src/modules/admin/http/routes.ts`
- Modify: `src/modules/admin/service/admin-service.ts`
- Modify: `src/infra/db/repositories/project-repository.ts`
- Modify: `src/infra/db/repositories/api-key-repository.ts`
- Modify: `src/infra/db/repositories/credential-repository.ts`
- Modify: read-model repository files as needed
- Test: `tests/admin/*`

**Step 1: Write the failing backend tests**

Add route tests for:

- list projects
- get project detail
- list project keys
- list project bindings
- get credential metadata without raw secret

**Step 2: Run test to verify it fails**

Run: `pnpm test -- --run tests/admin`
Expected: FAIL with missing routes or unsupported repository methods.

**Step 3: Write minimal implementation**

Add read-only admin endpoints and service methods that return operator-safe read models.

Required response properties should include:

- project identity and status
- binding state by capability
- key ids and statuses
- credential metadata without secret

**Step 4: Run test to verify it passes**

Run: `pnpm test -- --run tests/admin`
Expected: PASS for the new admin read endpoints.

**Step 5: Commit**

```bash
git add src tests/admin
git commit -m "feat: add operator read endpoints"
```

### Task 28: Build project and detail views

**Files:**
- Create: `frontend/src/routes/projects/*`
- Create: `frontend/src/components/layout/*`
- Create: `frontend/src/components/projects/*`
- Create: `frontend/src/lib/api.ts`
- Create: `frontend/src/lib/types.ts`
- Test: `frontend/src/routes/projects/*.test.tsx`

**Step 1: Write the failing frontend tests**

Add tests covering:

- projects list renders fetched projects
- create-project form submits and refreshes list
- project detail renders summary sections

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test`
Expected: FAIL because project pages do not exist.

**Step 3: Write minimal implementation**

Implement:

- left-nav shell
- projects list page
- create project modal or inline form
- project detail page with summary panels

**Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test`
Expected: PASS for project page tests.

**Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add operator project views"
```

### Task 29: Build credential, binding, and API key management flows

**Files:**
- Create: `frontend/src/routes/credentials/*`
- Create: `frontend/src/routes/bindings/*`
- Create: `frontend/src/routes/keys/*`
- Create: `frontend/src/components/forms/*`
- Test: `frontend/src/routes/**/*.test.tsx`

**Step 1: Write the failing frontend tests**

Add tests covering:

- credential attach / rotate submission
- binding toggle and priority update
- key mint action with reveal-once raw key display
- key disable action updates status

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test`
Expected: FAIL because these management flows are not implemented.

**Step 3: Write minimal implementation**

Implement the management surfaces around the existing admin mutations with operator-safe copy:

- write-only credential submission
- capability binding editor for Brave MVP capabilities
- key list and key actions
- reveal-once raw key dialog after mint

**Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test`
Expected: PASS for credential, binding, and key tests.

**Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add operator management workflows"
```

### Task 30: Build the Phase 2.5 flow runner

**Files:**
- Create: `frontend/src/routes/flow-runner/*`
- Create: `frontend/src/components/flow-runner/*`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/routes/flow-runner/*.test.tsx`

**Step 1: Write the failing frontend tests**

Add tests covering a runbook UI that:

- sequences the ten Phase 2.5 steps
- records per-step success / failure state
- shows HTTP status for verification steps
- shows result count for search steps

**Step 2: Run test to verify it fails**

Run: `pnpm --dir frontend test`
Expected: FAIL because the flow runner route does not exist.

**Step 3: Write minimal implementation**

Build a guided runbook page that can:

- select or create a project context
- attach credential
- configure `search.web`
- mint two keys
- trigger canonical search with each key
- disable one key
- rerun verification calls

**Step 4: Run test to verify it passes**

Run: `pnpm --dir frontend test`
Expected: PASS for the flow-runner tests.

**Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat: add phase 2.5 operator flow runner"
```

### Task 31: Wire frontend verification into repo delivery gates

**Files:**
- Modify: `scripts/validate.sh`
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `docs/plans/2026-03-20-local-dev-checklist.md`
- Create if needed: `frontend/README.md`

**Step 1: Write the failing validation hook**

Update validation expectations so frontend typecheck, test, and build are required.
Update validation expectations so frontend lint, typecheck, test, and build are required.

**Step 2: Run validation to verify it fails**

Run: `bash scripts/validate.sh`
Expected: FAIL until the frontend commands and docs are wired correctly.

**Step 3: Write minimal implementation**

Update:

- delivery gate script
- local startup docs
- operator workflow docs
- frontend run instructions

Include a documented manual verification for the ten-step Phase 2.5 UI workflow.

**Step 4: Run validation to verify it passes**

Run: `bash scripts/validate.sh`
Expected: PASS including frontend checks.

**Step 5: Commit**

```bash
git add scripts README.md docs frontend/README.md
git commit -m "chore: wire operator frontend into validation"
```

## Handoff Notes

- The frontend is intentionally operator-only.
- Any backend shape added for the UI must remain admin-safe and must not leak secrets.
- The flow runner is not optional polish; it is the proof surface for the Phase 2.5 product loop.
- If a task requires broader product changes, update `docs/product.md` and `docs/architecture.md` before implementation.

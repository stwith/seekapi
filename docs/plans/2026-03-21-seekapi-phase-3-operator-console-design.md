# SeekAPI Phase 3 Operator Console Design

**Date:** 2026-03-21

**Status:** Proposed

**Goal:** Define a minimal operator-facing web console that lets an internal operator execute and inspect the full Phase 2.5 Brave-only service-distributor workflow without direct database edits or curl-first operation.

## Why This Phase Exists

Phase 2.5 proved the Brave-only control plane can work end to end:

- create project
- attach Brave credential
- configure Brave capability binding
- mint multiple downstream SeekAPI keys
- run real searches
- disable one key without affecting another

That flow is now functional but still primarily operator-hostile because it depends on admin API calls and manual sequencing. Before expanding to a second provider, SeekAPI should expose the existing control plane through a small internal console so the product loop is operable by inspection, not just by scripts.

This phase inserts a UI phase before the old multi-provider phase.

## Product Position

This console is:

- an internal operator tool
- a thin control-plane client over the existing admin and canonical APIs
- a way to visualize and execute the Brave-only distributor workflow

This console is not:

- a tenant self-serve portal
- a billing surface
- a user account system
- a replacement for the canonical API product

Clients still authenticate to search using SeekAPI-issued API keys. The console exists to manage and verify that model, not to replace it.

## Reference Direction from sub2api

`sub2api` uses a single frontend application with route partitions for both user and admin surfaces, rather than two separate frontend projects. Its useful lessons for SeekAPI are structural, not product-level:

- one frontend app is enough
- route groups and shared layout are sufficient
- admin pages are mostly table + form workflows
- the visual goal is operational clarity, not novelty

SeekAPI should copy the operational simplicity, but not the full product scope. The correct analogue is the `admin` section only, not the user dashboard, auth center, redeem flows, or account marketplace.

## Recommended Approach

Use one small frontend app, mounted as an operator console, with a narrow page set and no separate user-facing area.

Recommended stack:

- Vite
- React + TypeScript
- simple router
- lightweight data fetching
- no design-system overbuild

Why this approach:

- it matches the current TypeScript repo and minimizes tool sprawl
- it keeps the UI harness small enough for internal operations
- it avoids coupling the console to a future end-user auth model

## Frontend Scope

The phase should ship one operator console with these top-level sections:

### 1. Overview

Purpose:

- show server reachability
- show configured admin endpoint target
- show recent projects and their readiness state
- show whether Phase 2.5 can be run from the UI

This page is for orientation, not analytics depth.

### 2. Projects

Purpose:

- list projects
- create project
- open project detail

Project detail should show:

- project metadata
- Brave credential state
- capability bindings
- issued downstream keys
- quick actions for the full distributor flow

### 3. Credentials

Purpose:

- attach or rotate Brave credential for a project
- show provider, status, rotated-at metadata
- never reveal stored raw secret after submission

This page is still project-centric. A global credential inventory is optional, not required for first release.

### 4. Bindings

Purpose:

- configure Brave bindings for `search.web`, `search.news`, and `search.images`
- toggle enabled state
- set priority

The UI must preserve the canonical capability vocabulary and never expose provider-native request knobs here.

### 5. API Keys

Purpose:

- mint downstream SeekAPI keys
- show status and attribution metadata
- disable keys
- show one-time raw key only at creation time

This section should optimize for operator safety:

- raw key displayed once
- clear warning that it cannot be recovered
- disabled keys clearly marked

### 6. Flow Runner

Purpose:

- execute the proven Phase 2.5 workflow from the UI
- visualize each step and the returned status
- optionally run a real search smoke test with a selected key

This is the distinctive SeekAPI page. It makes the existing backend flow visible and replayable.

## Phase 2.5 Workflow Embedded in the UI

The console should treat the following as the primary happy path:

1. Create project
2. Attach Brave credential
3. Enable `search.web`
4. Mint Key A
5. Mint Key B
6. Search with Key A
7. Search with Key B
8. Disable Key B
9. Verify Key B gets `401`
10. Verify Key A still succeeds

The UI should present this as a guided runbook, not merely as disconnected CRUD pages.

Recommended interaction model:

- each step can be run individually
- completed steps show timestamp and response summary
- failures show raw HTTP status plus normalized error message
- successful search steps show compact result counts and sample titles

This makes the UI useful both for daily operations and for regression verification.

## Backend Contract Impact

The console should prefer existing endpoints where possible, but Phase 3 should explicitly allow adding read-oriented admin endpoints that the current control plane lacks.

Current admin routes are sufficient for basic mutation flow:

- create project
- create key
- disable key
- upsert credential
- configure binding

But a usable console also needs read models. The likely additions are:

- list projects
- get project detail
- list project keys
- list project bindings
- get credential metadata without exposing secret
- optional recent usage and audit summaries per project

These read endpoints should still respect the existing layering:

- transport validates and authenticates
- service composes operator read models
- repositories fetch persisted state
- no UI-specific DB access shortcuts

## UX Guardrails

The console should be intentionally plain and operational:

- one shared shell
- left navigation
- list-detail workflows
- modal or drawer forms for create / rotate actions
- no marketing pages
- no user session model beyond operator auth bootstrap

Avoid copying `sub2api` features that do not match SeekAPI's product boundary:

- user registration
- user dashboard
- redeem codes
- balances
- proxy/account marketplace concepts

## Security Guardrails

- operator auth remains `ADMIN_API_KEY` in this phase
- raw provider secret is write-only
- raw downstream API key is reveal-once only
- the frontend must not persist raw admin key or downstream keys to logs
- if browser-side persistence is used at all, keep it limited to non-secret endpoint preferences

## Packaging Recommendation

Recommended default:

- create a dedicated `frontend/` directory
- keep it as a separate Vite application inside the same repo
- build it independently from the API server

Why:

- separates API runtime from frontend tooling
- preserves backend harness clarity
- makes it easy to serve statically later or host separately

Do not force SSR, Next.js, or a monorepo toolchain in this phase.

## Architecture Boundaries

The operator console may call:

- admin HTTP endpoints under `/v1/admin/*`
- canonical search endpoints for flow verification
- optional operator-read endpoints added in this phase

The operator console may not:

- talk to PostgreSQL directly
- bypass the service layer
- use provider-native APIs directly
- introduce provider-specific fields into canonical UI concepts unless explicitly marked as provider metadata

## Validation Model

The phase should be considered complete only when an operator can use the console to prove the full Brave-only distributor workflow with no direct DB edits and minimal curl usage.

Minimum validation evidence:

- create project from UI
- attach Brave credential from UI
- configure Brave `search.web` binding from UI
- mint two keys from UI
- run real search using Key A and Key B from UI
- disable Key B from UI
- verify Key B fails and Key A still passes

## Deferred Items

Explicitly defer:

- user-facing login and self-serve tenant pages
- billing views
- multi-provider routing UI
- quota dashboards
- advanced usage analytics
- phase-4 provider-comparison controls

## Recommendation

Insert this operator-console phase as the new Phase 3.

Push the previous multi-provider validation phase to Phase 4.
That keeps the sequence coherent:

- Phase 2.5: Brave-only control plane works
- Phase 3: Brave-only control plane becomes operable through UI
- Phase 4: add second provider on top of a real operator product loop

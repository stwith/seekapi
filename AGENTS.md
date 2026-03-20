# Agent Entry

## First Read

- [docs/product.md](/Users/cjs/Codes/seekapi/docs/product.md)
- [docs/architecture.md](/Users/cjs/Codes/seekapi/docs/architecture.md)
- [docs/plans/](/Users/cjs/Codes/seekapi/docs/plans)

## Repository Purpose

This repository builds SeekAPI, a pure API gateway for search and agent-facing service providers.
The initial provider is Brave via BYOK.
The architecture must support adding Tavily, Kagi, SerpAPI, Perplexity, and Firecrawl without rewriting the core platform.

## Roles

- Human defines goal, acceptance criteria, constraints, and non-goals.
- Agent implements, validates, fixes, and updates docs and examples.
- Rule layer enforces mechanical checks through scripts and CI.

## Task Flow

1. Read the active plan in `docs/plans/`.
2. Map every AC to implementation and tests before writing code.
3. Implement the smallest change that satisfies the active plan.
4. Run `bash scripts/validate.sh`.
5. Fix all failures before asking for review.
6. Update docs and examples when behavior or boundaries change.

## Non-Negotiable Rules

- Do not start implementation without an active plan.
- Do not do plan-external work unless the plan is updated first.
- Do not access persistence from HTTP handlers directly.
- Do not bypass the service layer from transport handlers.
- Do not put provider-specific request or response shapes into canonical API contracts unless intentionally promoted.
- Do not return HTTP response objects from service code.
- Do not store or log raw provider secrets.
- Do not finish work without running `bash scripts/validate.sh`.

## Layering Rules

- Transport layer may validate HTTP schemas, authenticate requests, and call services.
- Service layer owns business flow, routing, policy, and orchestration.
- Repository layer owns database persistence.
- Provider adapters own upstream provider HTTP logic and provider-specific mapping.
- Canonical schemas belong at the boundary layer only.

## Delivery Gate

Before handoff or review, confirm:

1. All changes come from the active plan.
2. Each AC has validation evidence.
3. Failure paths and boundary cases were covered.
4. Architecture rules were not violated.
5. The repo passes `bash scripts/validate.sh`.
6. Docs and examples were updated if needed.

## Reference Documents

- [docs/product.md](/Users/cjs/Codes/seekapi/docs/product.md)
- [docs/architecture.md](/Users/cjs/Codes/seekapi/docs/architecture.md)
- [docs/debugging.md](/Users/cjs/Codes/seekapi/docs/debugging.md)
- [docs/plans/2026-03-20-seekapi-design.md](/Users/cjs/Codes/seekapi/docs/plans/2026-03-20-seekapi-design.md)
- [docs/plans/2026-03-20-seekapi-implementation-plan.md](/Users/cjs/Codes/seekapi/docs/plans/2026-03-20-seekapi-implementation-plan.md)

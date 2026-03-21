# SeekAPI

Pure API gateway for search and agent-facing service providers.

SeekAPI exposes canonical search endpoints (`/v1/search/web`, `/v1/search/news`, `/v1/search/images`) and routes requests to upstream providers through provider adapters. The first supported provider is Brave via BYOK (bring your own key).

## Quick Start

```bash
# Install dependencies
npm install

# Set the required encryption key
export ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Optionally set your Brave API key for real searches
export BRAVE_API_KEY=BSA...your-key...

# Start in development mode
npm run dev
```

Verify the server is running:

```bash
curl http://localhost:3000/v1/health
# → {"status":"ok","timestamp":"..."}
```

Run a web search:

```bash
curl -X POST http://localhost:3000/v1/search/web \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_test_seekapi_demo_key_001" \
  -d '{"query": "hello world"}'
```

For the full walkthrough — environment setup, bootstrap flow, hitting every endpoint, manual Brave smoke checks, and running the delivery gate — see the [Local Dev Checklist](docs/plans/2026-03-20-local-dev-checklist.md).

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start with hot reload (auto-loads `.env`) |
| `npm run build`      | Compile TypeScript                 |
| `npm start`          | Run compiled output                |
| `npm test`           | Run tests (vitest)                 |
| `npm run lint`       | Lint source                        |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run db:generate`| Generate Drizzle migrations        |
| `npm run db:migrate` | Apply Drizzle migrations            |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_KEY` | **Yes** | 32-byte hex key for credential encryption at rest |
| `BRAVE_API_KEY` | For search | Brave Search API key (BYOK) |
| `DATABASE_URL` | No | PostgreSQL for durable persistence (usage, audit, health) |
| `REDIS_URL` | No | Redis for durable rate limiting |
| `PORT` | No | Server port (default: 3000) |
| `LOG_LEVEL` | No | Pino log level (default: info) |

Without `DATABASE_URL` or `REDIS_URL`, the server uses in-memory stores. All tests run without external dependencies.

## Validation

The delivery gate for this repository is:

```bash
bash scripts/validate.sh
```

This runs lint, typecheck, tests, build, architecture checks, AC coverage checks, and smoke checks.

Pull request review in this repository is based on Codex's GitHub integration, not a repository `OPENAI_API_KEY` secret. Trigger Codex in GitHub with `@codex review`, or enable Codex auto-review for the repository in GitHub/Codex settings.

## PR Loop

Use the local helper to standardize task PR creation.

```bash
bash scripts/open-pr.sh
```

To request repository-side auto-merge after the review loop is green:

```bash
bash scripts/open-pr.sh --automerge
```

This helper runs `bash scripts/validate.sh`, pushes the current branch, opens or updates a PR against `main`, and applies the `task` label plus the optional `automerge` label.

The actual model review is expected to come from Codex on GitHub via `@codex review` or repository-level Codex auto-review.

For the Claude repair loop, use the structured Codex review comment protocol.

- Codex reviewer should keep one PR comment marked `<!-- seekapi-codex-review -->`
- That comment must include `STATUS: READY` or `STATUS: BLOCKED`
- Before posting `STATUS: READY`, resolve the fixed review threads first so the merge gate can pass immediately
- Claude should consume the latest blocked review with:

```bash
bash scripts/claude-fix-pr.sh <pr-number>
```

The helper prints the exact repair prompt Claude should follow for that PR.

## Architecture and Plans

- [AGENTS.md](./AGENTS.md) - Agent entry point and rules
- [docs/product.md](./docs/product.md) - Product boundary and scope
- [docs/architecture.md](./docs/architecture.md) - Layering and dependency rules
- [docs/seekapi-global-architecture.md](./docs/seekapi-global-architecture.md) - Global system framing and stage priorities
- [docs/debugging.md](./docs/debugging.md) - Debugging workflow
- [docs/plans/2026-03-20-local-dev-checklist.md](./docs/plans/2026-03-20-local-dev-checklist.md) - Local dev setup and verification
- [docs/plans/2026-03-21-seekapi-phase-2-plan.md](./docs/plans/2026-03-21-seekapi-phase-2-plan.md) - Phase 2 implementation target
- [docs/plans/2026-03-21-seekapi-phase-2-5-plan.md](./docs/plans/2026-03-21-seekapi-phase-2-5-plan.md) - Phase 2.5 Brave-only key distribution target
- [docs/plans/2026-03-21-seekapi-phase-3-plan.md](./docs/plans/2026-03-21-seekapi-phase-3-plan.md) - Phase 3 multi-provider expansion target
- [docs/plans/](./docs/plans/) - Active implementation plans

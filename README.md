# SeekAPI

Pure API gateway for search and agent-facing service providers.

SeekAPI exposes canonical search endpoints (`/v1/search/web`, `/v1/search/news`, `/v1/search/images`) and routes requests to upstream providers through provider adapters. The first supported provider is Brave via BYOK (bring your own key).

## Quick Start

```bash
# Install dependencies
pnpm install

# Set the required encryption key
export ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000

# Optionally set your Brave API key for real searches
export BRAVE_API_KEY=BSA...your-key...

# Start in development mode
pnpm run dev
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

## Operator Bootstrap (Admin API)

SeekAPI includes an admin API for managing projects, API keys, and Brave credentials without direct database access. Set `ADMIN_API_KEY` to enable it.

> **Durability:** Without `DATABASE_URL`, all admin-created projects, keys, and credentials are stored in-memory and **lost on restart**. For production use, set `DATABASE_URL` to a PostgreSQL instance and run `pnpm run db:migrate` first.

```bash
# Production setup (durable)
export DATABASE_URL=postgres://seekapi:seekapi@localhost:5432/seekapi
export ADMIN_API_KEY=your_admin_secret
export ENCRYPTION_KEY=$(openssl rand -hex 32)
pnpm run db:migrate
pnpm run dev
```

Create a project, attach a Brave credential, and mint downstream keys:

```bash
BASE=http://localhost:3000
ADMIN="Authorization: Bearer $ADMIN_API_KEY"

# 1. Create a project
PROJECT_ID=$(curl -s -X POST $BASE/v1/admin/projects \
  -H "Content-Type: application/json" -H "$ADMIN" \
  -d '{"name":"My Project"}' | jq -r '.id')

# 2. Attach your Brave API key
curl -s -X POST $BASE/v1/admin/projects/$PROJECT_ID/credentials \
  -H "Content-Type: application/json" -H "$ADMIN" \
  -d '{"provider":"brave","secret":"BSA...your-key..."}'

# 3. Enable Brave web search
curl -s -X POST $BASE/v1/admin/projects/$PROJECT_ID/bindings \
  -H "Content-Type: application/json" -H "$ADMIN" \
  -d '{"provider":"brave","capability":"search.web"}'

# 4. Mint a downstream API key
API_KEY=$(curl -s -X POST $BASE/v1/admin/projects/$PROJECT_ID/keys \
  -H "$ADMIN" | jq -r '.rawKey')

# 5. Search with the new key
curl -s -X POST $BASE/v1/search/web \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"query":"hello world"}'
```

Each downstream key is independently controllable (disable via `POST /v1/admin/keys/:id/disable`) and individually attributable in usage events and audit logs. See the [Local Dev Checklist](docs/plans/2026-03-20-local-dev-checklist.md) for the full admin workflow.

## Operator Console

SeekAPI includes an operator-facing web console for managing the Brave-only control plane without curl or direct API calls.

```bash
# Install frontend dependencies
pnpm --dir frontend install

# Start the console (dev mode)
pnpm --dir frontend run dev
```

The console runs at `http://localhost:5173` and proxies API requests to `http://localhost:3000`. Enter your `ADMIN_API_KEY` to connect.

Console pages:
- **Overview** — server status and project summary
- **Projects** — create, list, and inspect projects (credential, bindings, keys)
- **Flow Runner** — execute the full Phase 2.5 workflow in 10 guided steps

The Flow Runner covers:
1. Create project
2. Attach Brave credential
3. Enable `search.web`
4. Mint Key A / Key B
5. Search with both keys
6. Disable Key B
7. Verify Key B gets 401, Key A still succeeds

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `pnpm run dev`        | Start with hot reload (auto-loads `.env`) |
| `pnpm run build`      | Compile TypeScript                 |
| `pnpm start`          | Run compiled output                |
| `pnpm test`           | Run tests (vitest)                 |
| `pnpm run lint`       | Lint source                        |
| `pnpm run typecheck`  | Type-check without emitting        |
| `pnpm run db:generate`| Generate Drizzle migrations        |
| `pnpm run db:migrate` | Apply Drizzle migrations            |
| `pnpm --dir frontend run dev` | Start operator console     |
| `pnpm --dir frontend test`    | Run frontend tests          |
| `pnpm --dir frontend run build` | Build frontend for production |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ENCRYPTION_KEY` | **Yes** | 32-byte hex key for credential encryption at rest |
| `BRAVE_API_KEY` | For search | Brave Search API key (BYOK) |
| `ADMIN_API_KEY` | For admin | Enables operator management endpoints (`/v1/admin/*`) |
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
- [docs/plans/2026-03-21-seekapi-phase-3-operator-console-design.md](./docs/plans/2026-03-21-seekapi-phase-3-operator-console-design.md) - Phase 3 operator console design
- [docs/plans/2026-03-21-seekapi-phase-3-operator-console-plan.md](./docs/plans/2026-03-21-seekapi-phase-3-operator-console-plan.md) - Phase 3 operator console implementation target
- [docs/plans/2026-03-21-seekapi-phase-4-plan.md](./docs/plans/2026-03-21-seekapi-phase-4-plan.md) - Phase 4 multi-provider expansion target
- [docs/plans/](./docs/plans/) - Active implementation plans

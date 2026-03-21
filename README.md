# SeekAPI

Pure API gateway for search and agent-facing service providers.

SeekAPI exposes canonical search endpoints (`/v1/search/web`, `/v1/search/news`, `/v1/search/images`) and routes requests to upstream providers through provider adapters. The first supported provider is Brave via BYOK (bring your own key).

## Quick Start

```bash
# Install dependencies
npm install

# Run tests and type-check
npm test
npm run typecheck

# Start in development mode
npm run dev
```

Verify the server is running:

```bash
curl http://localhost:3000/v1/health
# → {"status":"ok","timestamp":"..."}
```

For a full walkthrough — starting dependencies, setting env vars, seeding data, hitting every endpoint, and running the delivery gate — see the [Local Dev Checklist](docs/plans/2026-03-20-local-dev-checklist.md).

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start with hot reload (tsx watch)  |
| `npm run build`      | Compile TypeScript                 |
| `npm start`          | Run compiled output                |
| `npm test`           | Run tests (vitest)                 |
| `npm run lint`       | Lint source                        |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run db:generate`| Generate Drizzle migrations        |
| `npm run db:migrate` | Apply Drizzle migrations            |

## Validation

The delivery gate for this repository is:

```bash
bash scripts/validate.sh
```

This runs lint, typecheck, tests, build, architecture checks, AC coverage checks, and smoke checks.

Pull request review in this repository is based on Codex's GitHub integration, not a repository `OPENAI_API_KEY` secret. Trigger Codex in GitHub with `@codex review`, or enable Codex auto-review for the repository in GitHub/Codex settings. [AC3][AC4][AC5]

## PR Loop

Use the local helper to standardize task PR creation. [AC1][AC3]

```bash
bash scripts/open-pr.sh
```

To request repository-side auto-merge after the review loop is green:

```bash
bash scripts/open-pr.sh --automerge
```

This helper runs `bash scripts/validate.sh`, pushes the current branch, opens or updates a PR against `main`, and applies the `task` label plus the optional `automerge` label.

The actual model review is expected to come from Codex on GitHub via `@codex review` or repository-level Codex auto-review.

For the Claude repair loop, use the structured Codex review comment protocol. [AC3]

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
- [docs/debugging.md](./docs/debugging.md) - Debugging workflow
- [docs/plans/](./docs/plans/) - Active implementation plans

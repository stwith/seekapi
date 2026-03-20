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

> Database migrations (`npm run db:migrate`) and demo data seeding (`bash scripts/seed-demo-data.sh`) require PostgreSQL and Redis and will be available after Task 5.

## Scripts

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `npm run dev`        | Start with hot reload (tsx watch)  |
| `npm run build`      | Compile TypeScript                 |
| `npm start`          | Run compiled output                |
| `npm test`           | Run tests (vitest)                 |
| `npm run lint`       | Lint source                        |
| `npm run typecheck`  | Type-check without emitting        |
| `npm run db:generate`| Generate Drizzle migrations (requires DB schema, Task 5+) |
| `npm run db:migrate` | Apply Drizzle migrations (requires DB schema, Task 5+)    |

## Validation

The delivery gate for this repository is:

```bash
bash scripts/validate.sh
```

This runs lint, typecheck, tests, build, architecture checks, AC coverage checks, and smoke checks.

AI pull request review is optional and can be enabled by adding the `OPENAI_API_KEY` repository Actions secret. You may also set `OPENAI_REVIEW_MODEL` as a repository variable to override the default review model.

## Architecture and Plans

- [AGENTS.md](./AGENTS.md) - Agent entry point and rules
- [docs/product.md](./docs/product.md) - Product boundary and scope
- [docs/architecture.md](./docs/architecture.md) - Layering and dependency rules
- [docs/debugging.md](./docs/debugging.md) - Debugging workflow
- [docs/plans/](./docs/plans/) - Active implementation plans

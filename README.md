# SeekAPI

Pure API gateway for search and agent-facing service providers.

SeekAPI exposes canonical search endpoints (`/v1/search/web`, `/v1/search/news`, `/v1/search/images`) and routes requests to upstream providers through provider adapters. The first supported provider is Brave via BYOK (bring your own key).

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your database, Redis, and encryption key values

# Run database migrations
npm run db:migrate

# Seed demo data (project, API key, provider credential)
bash scripts/seed-demo-data.sh

# Start in development mode
npm run dev
```

## Scripts

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| `npm run dev`      | Start with hot reload (tsx watch)  |
| `npm run build`    | Compile TypeScript                 |
| `npm start`        | Run compiled output                |
| `npm test`         | Run tests (vitest)                 |
| `npm run lint`     | Lint source and tests              |
| `npm run typecheck`| Type-check without emitting        |
| `npm run db:generate` | Generate Drizzle migrations     |
| `npm run db:migrate`  | Apply Drizzle migrations        |

## Validation

The delivery gate for this repository is:

```bash
bash scripts/validate.sh
```

This runs lint, typecheck, tests, build, architecture checks, AC coverage checks, and smoke checks.

## Architecture and Plans

- [AGENTS.md](./AGENTS.md) - Agent entry point and rules
- [docs/product.md](./docs/product.md) - Product boundary and scope
- [docs/architecture.md](./docs/architecture.md) - Layering and dependency rules
- [docs/debugging.md](./docs/debugging.md) - Debugging workflow
- [docs/plans/](./docs/plans/) - Active implementation plans

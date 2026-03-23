# Quota Enforcement & Quality Fixes

Status: **active**

## Goal

Fix 4 verified issues: quota enforcement gaps, validate.sh silent skip, credential ref edge case, and frontend test masking.

## Acceptance Criteria

### AC1: maxKeys enforced on key creation
- `AdminService.createApiKey` checks current key count against project quota `maxKeys`
- Rejects with `MAX_KEYS_EXCEEDED` error when limit reached
- HTTP layer maps to 422
- Test: attempt to create key beyond maxKeys limit → rejected

### AC2: rateLimitRpm reads from project quota
- Rate limit pre-handler reads `rateLimitRpm` from project quota instead of hardcoded default
- Fallback to default when no quota exists
- Test: project with custom rateLimitRpm → rate limiter uses that value

### AC3: daily/monthly limits — honest UI
- Since full runtime enforcement of daily/monthly counters requires request-time increment + check (significant scope), and this plan is minimal fixes:
- Option chosen: add clear "(not yet enforced)" indicator or remove daily/monthly fields from edit UI
- Non-goal: implementing full daily/monthly counter enforcement in this plan

### AC4: validate.sh auto-installs root deps
- When root `node_modules` missing, auto-install via `pnpm install --frozen-lockfile` (same as frontend behavior)
- Never silently skip backend validation
- Test: remove node_modules, run validate.sh → installs and validates

### AC5: removeCredentialRef validates project exists
- Service layer checks project existence before removing ref
- Throws `PROJECT_NOT_FOUND` for non-existent projects
- HTTP layer maps to 404
- Test: DELETE ref for non-existent project → 404

### AC6: Dashboard test mocks match real data shapes
- app-shell.test.tsx mocks return correct DashboardStats/TimeSeries/etc shapes
- Dashboard component adds defensive guards for undefined data
- Tests no longer silently pass via ErrorBoundary catching null pointer errors

## Constraints

- Minimal fixes only, no UI redesign
- Preserve service/repository/transport layering
- Tests first where possible
- Must pass `bash scripts/validate.sh`

## Non-Goals

- Full daily/monthly request counter enforcement (future plan)
- Rate limit algorithm changes beyond reading project config
- UI visual changes beyond removing misleading quota fields

## Validation Commands

```bash
bash scripts/validate.sh
```

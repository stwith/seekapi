# Debugging Guide

## Purpose

This document explains the minimum debugging workflow for SeekAPI.
It exists so an agent or reviewer can start the system, prepare data, run smoke checks, and understand common failure points.

## Standard Flow

1. Start dependencies.
2. Seed demo data.
3. Start the app.
4. Run smoke.
5. Inspect logs and traces.

## Expected Helper Scripts

- `bash scripts/dev.sh`
- `bash scripts/seed-demo-data.sh`
- `bash scripts/smoke.sh`
- `bash scripts/validate.sh`

## GitHub Loop

- `.github/workflows/ci.yml` mirrors the local delivery gate on pushes and pull requests.
- `.github/workflows/pr-review.yml` posts or updates a sticky pull request comment with changed files and current check status.
- `.github/workflows/auto-merge.yml` can squash-merge PRs labeled `automerge` once `validate` and `comment` are green, the latest structured Codex review is `READY`, and review threads are resolved. [AC2][AC3]
- `bash scripts/open-pr.sh` standardizes the local branch -> validate -> push -> PR flow and can add `automerge` on request. [AC1][AC3]
- `bash scripts/claude-fix-pr.sh <pr-number>` renders the latest structured Codex review comment into a repair prompt for Claude. [AC1][AC3]
- Local debugging still starts with `bash scripts/validate.sh`; GitHub Actions should confirm the same gate remotely.
- GitHub workflows can react to PR events, but the actual Codex review still comes from the GitHub/Codex integration rather than an Actions API key.

## Codex Review Comment Protocol

- Keep one sticky comment marked `<!-- seekapi-codex-review -->`
- Include `STATUS: READY` when the PR is mergeable
- Include `STATUS: BLOCKED` when Claude still has fixes to make
- List blocking issues with a `BLOCKING:` prefix so Claude can repair them deterministically
- Resolve fixed review threads before posting `STATUS: READY`
- Auto-merge will wait for the latest Codex review status to become `READY` and for all review threads to be resolved

## Common Failure Buckets

### Validation Failures

Symptoms:

- request rejected with 400
- missing or malformed fields

Check:

- route schema
- canonical request contract
- test coverage for AC labels

### Auth Failures

Symptoms:

- request rejected with 401 or 403

Check:

- downstream API key loading
- hash comparison
- project capability policy

### Provider Failures

Symptoms:

- upstream timeout
- provider unavailable
- bad upstream credential

Check:

- provider adapter mapping
- provider credential decryption
- provider health state
- fallback classification

### Rate Limit Failures

Symptoms:

- repeated 429 responses

Check:

- Redis connectivity
- project rate limit policy
- keying strategy for counters

### Architecture Check Failures

Symptoms:

- `scripts/check-architecture.sh` fails

Check:

- direct transport-to-repository dependencies
- service references to HTTP response objects
- misplaced provider-specific schemas

## Logging Expectations

Logs should make these fields visible:

- request id
- project id
- capability
- selected provider
- fallback count
- error code

Sensitive data must remain redacted.

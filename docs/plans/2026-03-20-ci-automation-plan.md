# SeekAPI CI And PR Automation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a minimal GitHub-native delivery loop for SeekAPI so pushes and pull requests get deterministic validation, and pull requests receive an automated review comment that keeps the implementation loop moving.

**Architecture:** Keep the automation inside GitHub Actions. Use one workflow for hard delivery checks and a separate workflow for pull request review comments. The review workflow should be safe by default: it may summarize changes and validation state, but it must not execute untrusted code with elevated privileges or require external AI services to function.

**Tech Stack:** GitHub Actions, bash, Node.js 22, repository scripts, GitHub CLI-compatible markdown conventions

## Acceptance Criteria

AC1: The repository contains a CI workflow that runs on `push` and `pull_request`.

AC2: The CI workflow uses the repository delivery gate, centered on `bash scripts/validate.sh`, and works whether the repo is still in docs-only state or has a Node project scaffold.

AC3: The repository contains a pull request automation workflow that posts or updates a GitHub comment summarizing changed files and reminding reviewers about validation status and delivery expectations.

AC4: The pull request automation is safe by default: it does not require executing PR code with elevated secrets and does not depend on an external model API to produce a useful result.

AC5: Repository guidance is updated so contributors know the expected PR loop and where automation lives.

## Constraints

- Keep the automation GitHub-native.
- Do not require paid third-party services or model API secrets for baseline usefulness.
- Do not weaken the existing `scripts/validate.sh` delivery gate.
- Do not add product implementation work outside CI/PR automation.

## Non-Goals

- Automatic code modification on PR branches
- Automatic merge
- Full AI code review with proprietary model credentials
- Deployment automation
- Release orchestration

## Validation

- `bash scripts/validate.sh`
- `git diff --check`
- Manual review of `.github/workflows/ci.yml`
- Manual review of `.github/workflows/pr-review.yml`

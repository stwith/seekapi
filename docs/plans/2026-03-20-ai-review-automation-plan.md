# SeekAPI AI Review Automation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine repository ownership metadata and add an optional AI-assisted pull request review workflow that can post structured review feedback on PRs without weakening the existing CI gate.

**Architecture:** Keep ownership and review automation GitHub-native. Use a dedicated `CODEOWNERS` file with explicit path coverage, and add a separate GitHub Actions workflow that reads PR metadata through the GitHub API, optionally calls an AI model when `OPENAI_API_KEY` is configured, and posts or updates a sticky PR review comment. If the secret is absent, the workflow should exit safely without blocking merges.

**Tech Stack:** GitHub Actions, GitHub API, OpenAI Responses API, bash, inline Python/JavaScript

## Acceptance Criteria

AC1: The repository contains an explicit `CODEOWNERS` file that assigns ownership by major repository area.

AC2: The repository contains a dedicated AI review workflow for pull requests.

AC3: The AI review workflow uses only PR metadata and diffs gathered through the GitHub API and does not require checking out untrusted PR code with elevated secrets.

AC4: The AI review workflow safely no-ops when required secrets are missing and does not fail the repository delivery loop in that case.

AC5: Contributors can discover how the AI review workflow is enabled and what secret is required.

## Constraints

- Do not weaken the existing `validate` required check.
- Do not require AI review to pass before merge.
- Do not expose secrets to arbitrary PR code.
- Keep the workflow useful even when the AI secret is not configured.

## Non-Goals

- Automatic code modification on PR branches
- Automatic merge approvals
- Line-by-line inline review comments for every diff hunk
- Multi-provider AI review support

## Validation

- `bash scripts/validate.sh`
- `git diff --check`
- Manual review of `.github/CODEOWNERS`
- Manual review of `.github/workflows/ai-pr-review.yml`

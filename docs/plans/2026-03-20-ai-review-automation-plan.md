# SeekAPI AI Review Automation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refine repository ownership metadata and add an optional Codex-assisted pull request review workflow that can guide contributors into the GitHub-native review flow without weakening the existing CI gate.

**Architecture:** Keep ownership and review automation GitHub-native. Use a dedicated `CODEOWNERS` file with explicit path coverage, and add a separate GitHub Actions workflow that reads PR metadata through the GitHub API and posts or updates a sticky PR review guidance comment. The workflow must not call external model APIs or require repository API secrets. Contributors should trigger Codex review through the GitHub-native `@codex review` or repository auto-review flow, and the repo automation should remain safe and non-blocking when no structured Codex review comment exists yet.

**Tech Stack:** GitHub Actions, GitHub API, bash, inline JavaScript

## Acceptance Criteria

AC1: The repository contains an explicit `CODEOWNERS` file that assigns ownership by major repository area.

AC2: The repository contains a dedicated AI review workflow for pull requests.

AC3: The AI review workflow uses only PR metadata and diffs gathered through the GitHub API and does not require checking out untrusted PR code with elevated secrets.

AC4: The AI review workflow safely no-ops when no structured Codex review comment exists yet and does not fail the repository delivery loop in that case.

AC5: Contributors can discover how Codex review is triggered from GitHub and how the repository interprets the structured Codex review comment.

## Constraints

- Do not weaken the existing `validate` required check.
- Do not require AI review to pass before merge.
- Do not expose secrets to arbitrary PR code.
- Keep the workflow useful even when no Codex review has been requested yet.

## Non-Goals

- Automatic code modification on PR branches
- Automatic merge approvals
- Line-by-line inline review comments for every diff hunk
- Calling model APIs directly from GitHub Actions

## Validation

- `bash scripts/validate.sh`
- `git diff --check`
- Manual review of `.github/CODEOWNERS`
- Manual review of `.github/workflows/ai-pr-review.yml`

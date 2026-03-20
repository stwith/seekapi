# SeekAPI GitHub Repo Settings Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Configure SeekAPI GitHub repository settings so the delivery loop is enforced through pull requests, required checks, and conservative merge defaults.

**Architecture:** Use GitHub-native repository settings and branch protection on `main`. Prefer squash merges, automatic branch cleanup, and required CI checks that mirror the local `bash scripts/validate.sh` delivery gate.

**Tech Stack:** GitHub repository settings, branch protection rules, GitHub Actions

## Acceptance Criteria

AC1: `main` requires pull requests before merge.

AC2: `main` requires passing CI status checks before merge.

AC3: `main` requires branches to be up to date before merge.

AC4: Force pushes to `main` are blocked.

AC5: Repository merge settings are configured for a conservative review loop, including squash merge and automatic head branch deletion after merge.

AC6: The repository contains a `CODEOWNERS` file that assigns default review ownership for the current repository.

## Constraints

- Use current GitHub-native settings only.
- Do not weaken CI or branch protections.
- Do not require a new external service.

## Non-Goals

- Team or org-wide policy changes
- Deployment rulesets
- Custom GitHub App installation

## Validation

- `gh api repos/stwith/seekapi/branches/main/protection`
- `gh repo view stwith/seekapi --json mergeCommitAllowed,rebaseMergeAllowed,squashMergeAllowed,deleteBranchOnMerge`
- `gh run list --repo stwith/seekapi --limit 5`

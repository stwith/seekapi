# Review Loop Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Tighten the PR loop so Codex review status can gate merge and Claude has a deterministic way to consume review feedback for follow-up fixes.

**Architecture:** Treat Codex review as a structured PR comment protocol rather than an implicit human action. A local helper should fetch the latest Codex review marker comment and render a concrete repair prompt for Claude. The auto-merge workflow should merge only when the latest Codex review comment marks the PR ready and all review-loop checks pass with no unresolved review threads.

**Tech Stack:** Bash, Node.js, GitHub CLI, GitHub Actions, Vitest

**Acceptance Criteria**

- AC1: A local helper can read the latest structured Codex PR review comment and render a repair prompt for Claude.
- AC2: Auto-merge requires `automerge`, green checks, no unresolved review threads, and a latest Codex review status of `READY`.
- AC3: Repo docs explain the Codex review comment protocol and the exact handoff Claude should follow when repairing a PR after review.

### Task 1: Add the Claude review-consumption helper

**Files:**
- Create: `scripts/claude-fix-pr.js`
- Create: `scripts/claude-fix-pr.sh`
- Create: `tests/scripts/claude-fix-pr.test.ts`

**Step 1: Write the failing tests**

Create tests for:

- extracting the latest Codex review comment by marker
- building a Claude repair prompt that includes PR identity and the review body

**Step 2: Run the tests to confirm failure**

Run:

```bash
npm test -- tests/scripts/claude-fix-pr.test.ts
```

Expected:

- helper module missing or exports missing

**Step 3: Implement the helper**

Create a helper that:

- looks for the latest PR comment containing `<!-- seekapi-codex-review -->`
- expects a leading `STATUS: READY` or `STATUS: BLOCKED`
- prints a repair prompt for Claude based on the latest review comment

Tag helper implementation or tests with `[AC1]`.

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/scripts/claude-fix-pr.test.ts
```

Expected:

- helper tests pass

### Task 2: Tighten merge gating

**Files:**
- Modify: `.github/workflows/auto-merge.yml`

**Step 1: Extend the workflow**

Require:

- `automerge` label
- `validate`, `comment`, and `ai-review` checks all green
- no unresolved review threads
- latest Codex review comment marker reports `STATUS: READY`

Tag the workflow with `[AC2]`.

**Step 2: Verify syntax through the delivery gate**

Run:

```bash
bash scripts/validate.sh
```

Expected:

- full gate stays green

### Task 3: Document the protocol

**Files:**
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `.github/pull_request_template.md`

**Step 1: Document the review contract**

Explain:

- Codex reviewer should post one sticky comment marked `<!-- seekapi-codex-review -->`
- comment status line should be `STATUS: READY` or `STATUS: BLOCKED`
- Claude should consume the latest blocked review via `bash scripts/claude-fix-pr.sh <pr-number>`
- auto-merge only happens after the latest review reports `READY`

Tag doc updates with `[AC3]`.

**Step 2: Final validation**

Run:

```bash
bash scripts/validate.sh
```

Expected:

- full gate passes

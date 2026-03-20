# PR Loop Automation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Standardize local PR creation and add controlled repository-side auto-merge for green, labeled task PRs.

**Architecture:** Keep local developer workflow and GitHub-side merge policy separate. A local helper script should validate, push, and open or update a PR consistently. A GitHub Actions workflow should decide whether a PR is safe to merge based on labels and completed check runs, then merge and delete the source branch.

**Tech Stack:** Bash, Node.js, GitHub Actions, GitHub CLI, Vitest

**Acceptance Criteria**

- AC1: A local helper can validate the repo, push the current branch, and open or update a PR against `main`.
- AC2: GitHub can automatically squash-merge PRs only when they are open, non-draft, labeled `automerge`, and all review-loop checks pass.
- AC3: Repository docs explain the local PR helper, the `automerge` label contract, and the limitation that proactive Codex review requires a separate polling or webhook automation.

### Task 1: Add the local PR helper

**Files:**
- Create: `scripts/open-pr.js`
- Create: `scripts/open-pr.sh`
- Modify: `package.json`
- Test: `tests/scripts/open-pr.test.ts`

**Step 1: Write the failing tests**

Create tests for:

- argument parsing for `--title`, `--body-file`, and `--automerge`
- generated PR body includes the active plan and validation command

**Step 2: Run the tests to confirm failure**

Run:

```bash
npm test -- tests/scripts/open-pr.test.ts
```

Expected:

- missing helper module or missing exports

**Step 3: Implement the helper**

Add a Node-based helper plus a shell wrapper that:

- refuses to run on `main`
- runs `bash scripts/validate.sh`
- pushes the current branch
- creates or updates a PR
- ensures `task` and optional `automerge` labels exist

Tag helper implementation or tests with `[AC1]`.

**Step 4: Re-run tests**

Run:

```bash
npm test -- tests/scripts/open-pr.test.ts
```

Expected:

- helper tests pass

### Task 2: Add controlled auto-merge

**Files:**
- Create: `.github/workflows/auto-merge.yml`

**Step 1: Add the workflow**

Create a workflow that listens to pull request updates and review-loop workflow completions, then:

- checks for the `automerge` label
- requires PR base `main`
- requires PR open and non-draft
- requires successful `validate`, `comment`, and `ai-review` checks on the current head SHA
- squash merges and deletes the branch when safe

Tag the workflow with `[AC2]`.

**Step 2: Validate syntax and logic**

Run:

```bash
bash scripts/validate.sh
```

Expected:

- repository gate stays green

### Task 3: Update repository guidance

**Files:**
- Modify: `README.md`
- Modify: `docs/debugging.md`
- Modify: `.github/pull_request_template.md`

**Step 1: Document the loop**

Update docs to explain:

- how to run `bash scripts/open-pr.sh`
- how and when to use `--automerge`
- that repository workflows can auto-review and auto-merge
- that proactive Codex review still requires a separate polling or webhook automation

Tag doc updates with `[AC3]`.

**Step 2: Final validation**

Run:

```bash
bash scripts/validate.sh
```

Expected:

- full gate passes

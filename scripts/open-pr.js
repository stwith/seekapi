import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Parse supported CLI flags for the local PR helper. [AC1]
 */
export function parseArgs(argv) {
  const parsed = {
    title: undefined,
    bodyFile: undefined,
    automerge: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--title") {
      parsed.title = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--body-file") {
      parsed.bodyFile = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--automerge") {
      parsed.automerge = true;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (argv.includes("--title") && !parsed.title) {
    throw new Error("Missing value for --title");
  }

  if (argv.includes("--body-file") && !parsed.bodyFile) {
    throw new Error("Missing value for --body-file");
  }

  return parsed;
}

/**
 * Build a minimal PR body that matches the repo template. [AC1]
 */
export function buildPrBody({ planFile, validateCommand }) {
  return [
    "## Summary",
    "",
    "- automated PR opened with `scripts/open-pr.sh`",
    "- branch validated locally before push",
    "",
    "## Plan",
    "",
    `- active plan file: \`${planFile}\``,
    "- task(s) covered: current task branch scope",
    "",
    "## Validation",
    "",
    `- [x] \`${validateCommand}\``,
    "- [ ] targeted tests",
    "- [ ] smoke path checked when relevant",
    "",
    "## Review Notes",
    "",
    "- architecture or boundary changes: none beyond active task scope",
    "- failure paths covered: see local validation and PR diff",
    "- docs/examples updated if behavior changed: yes when applicable",
  ].join("\n");
}

export function normalizeExecOutput(output) {
  if (output == null) {
    return "";
  }

  return String(output).trim();
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  return normalizeExecOutput(output);
}

function currentBranch() {
  return run("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
}

function assertNotProtectedBranch(branch) {
  if (branch === "main" || branch === "master") {
    throw new Error("Refusing to open a PR from the protected default branch");
  }
}

function assertCleanWorkingTree() {
  const lines = run("git", ["status", "--porcelain"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line !== "?? .claude/");

  if (lines.length > 0) {
    throw new Error(
      `Working tree is not clean. Commit or stash changes before opening a PR:\n${lines.join("\n")}`,
    );
  }
}

function latestPlanFile() {
  const plansDir = path.join(process.cwd(), "docs", "plans");
  const entries = readdirSync(plansDir)
    .filter((entry) => entry.endsWith(".md") && entry !== "TEMPLATE.md")
    .map((entry) => {
      const fullPath = path.join(plansDir, entry);
      return {
        relativePath: path.join("docs", "plans", entry),
        mtimeMs: statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (entries.length === 0) {
    throw new Error("No active plan found in docs/plans");
  }

  return entries[0].relativePath;
}

function latestCommitTitle() {
  return run("git", ["log", "-1", "--pretty=%s"]);
}

function repoNameWithOwner() {
  return run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

function ensureLabel(name, color, description) {
  run(
    "gh",
    ["label", "create", name, "--color", color, "--description", description, "--force"],
    { stdio: "ignore" },
  );
}

function openPrForBranch(branch) {
  const output = run(
    "gh",
    ["pr", "list", "--head", branch, "--state", "open", "--json", "number,url"],
  );

  const pulls = JSON.parse(output);
  return pulls[0];
}

function addLabels(prNumber, labels) {
  if (labels.length === 0) {
    return;
  }

  run("gh", ["pr", "edit", String(prNumber), "--add-label", labels.join(",")], {
    stdio: "inherit",
  });
}

function createPr({ branch, title, body }) {
  return run(
    "gh",
    ["pr", "create", "--base", "main", "--head", branch, "--title", title, "--body", body],
    { stdio: ["inherit", "pipe", "inherit"] },
  );
}

function bodyFromFile(filePath) {
  return readFileSync(path.resolve(process.cwd(), filePath), "utf8");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const branch = currentBranch();

  assertNotProtectedBranch(branch);
  assertCleanWorkingTree();

  const planFile = latestPlanFile();
  const title = args.title ?? latestCommitTitle();
  const body = args.bodyFile
    ? bodyFromFile(args.bodyFile)
    : buildPrBody({
        planFile,
        validateCommand: "bash scripts/validate.sh",
      });

  run("bash", ["scripts/validate.sh"], { stdio: "inherit" });
  run("git", ["push", "-u", "origin", branch], { stdio: "inherit" });

  const repo = repoNameWithOwner();
  ensureLabel("task", "0e8a16", "Task-oriented implementation PR");
  if (args.automerge) {
    ensureLabel("automerge", "1d76db", "Safe to squash-merge automatically once checks pass");
  }

  const existing = openPrForBranch(branch);
  const labels = ["task"];
  if (args.automerge) {
    labels.push("automerge");
  }

  let prUrl = existing?.url;
  let prNumber = existing?.number;

  if (!existing) {
    prUrl = createPr({ branch, title, body });
    const created = openPrForBranch(branch);
    prNumber = created?.number;
  }

  if (!prNumber || !prUrl) {
    throw new Error("Failed to resolve pull request metadata after creation");
  }

  addLabels(prNumber, labels);

  console.log(`Opened PR on ${repo}: ${prUrl}`);
  if (args.automerge) {
    console.log("Auto-merge requested via the `automerge` label.");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

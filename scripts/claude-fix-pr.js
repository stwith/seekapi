import { execFileSync } from "node:child_process";

const CODEX_REVIEW_MARKER = "<!-- seekapi-codex-review -->";

/**
 * Extract the newest structured Codex review comment. [AC1]
 */
export function extractLatestCodexReview(comments) {
  const matches = comments
    .filter((comment) => typeof comment.body === "string")
    .filter((comment) => comment.body.includes(CODEX_REVIEW_MARKER))
    .map((comment) => {
      const statusMatch = comment.body.match(/STATUS:\s*(READY|BLOCKED)/);
      return {
        ...comment,
        status: statusMatch?.[1] ?? "UNKNOWN",
      };
    })
    .sort((a, b) => Date.parse(b.created_at ?? 0) - Date.parse(a.created_at ?? 0));

  return matches[0];
}

/**
 * Build the prompt Claude should use when repairing a reviewed PR. [AC1][AC3]
 */
export function buildClaudeFixPrompt({ prNumber, prUrl, reviewBody }) {
  return [
    `Work on PR #${prNumber}: ${prUrl}`,
    "",
    "Read the latest structured Codex review comment below and fix every `BLOCKING:` item before stopping.",
    "Do not do plan-external work.",
    "After fixing, run `bash scripts/validate.sh`, push the branch, and reply on the PR with what changed and the validation result.",
    "If there are no `BLOCKING:` items, do not change code.",
    "",
    "Latest Codex review comment:",
    reviewBody.trim(),
  ].join("\n");
}

function run(command, args) {
  const output = execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
  });

  return String(output ?? "").trim();
}

function getPullRequest(prNumber) {
  const output = run("gh", [
    "pr",
    "view",
    String(prNumber),
    "--json",
    "number,url,comments",
  ]);

  return JSON.parse(output);
}

function main() {
  const prNumber = process.argv[2];
  if (!prNumber) {
    throw new Error("Usage: bash scripts/claude-fix-pr.sh <pr-number>");
  }

  const pull = getPullRequest(prNumber);
  const latestReview = extractLatestCodexReview(pull.comments ?? []);

  if (!latestReview) {
    throw new Error(`No Codex review comment found on PR #${prNumber}`);
  }

  console.log(
    buildClaudeFixPrompt({
      prNumber: pull.number,
      prUrl: pull.url,
      reviewBody: latestReview.body,
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

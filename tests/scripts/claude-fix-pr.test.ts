import { describe, expect, test } from "vitest";
import {
  buildClaudeFixPrompt,
  extractLatestCodexReview,
} from "../../scripts/claude-fix-pr.js";

describe("claude-fix-pr helper", () => {
  test("extractLatestCodexReview returns the newest marked Codex comment", () => {
    const review = extractLatestCodexReview([
      { id: 1, body: "<!-- seekapi-codex-review -->\nSTATUS: BLOCKED\nold", created_at: "2026-03-20T10:00:00Z" },
      { id: 2, body: "normal comment", created_at: "2026-03-20T11:00:00Z" },
      { id: 3, body: "<!-- seekapi-codex-review -->\nSTATUS: READY\nnew", created_at: "2026-03-20T12:00:00Z" },
    ]);

    expect(review?.id).toBe(3);
    expect(review?.status).toBe("READY");
  });

  test("buildClaudeFixPrompt includes PR identity and review body", () => {
    const prompt = buildClaudeFixPrompt({
      prNumber: 7,
      prUrl: "https://github.com/stwith/seekapi/pull/7",
      reviewBody: "<!-- seekapi-codex-review -->\nSTATUS: BLOCKED\n- BLOCKING: fix auth edge case",
    });

    expect(prompt).toContain("PR #7");
    expect(prompt).toContain("https://github.com/stwith/seekapi/pull/7");
    expect(prompt).toContain("BLOCKING: fix auth edge case");
  });
});

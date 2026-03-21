import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readRepoFile(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Codex GitHub review automation", () => {
  test("AI review workflow guides contributors to Codex GitHub review instead of API key setup", () => {
    const workflow = readRepoFile(".github/workflows/ai-pr-review.yml");

    expect(workflow).toContain("@codex review");
    expect(workflow).not.toContain("Add repository secret `OPENAI_API_KEY`");
    expect(workflow).not.toContain("OPENAI_REVIEW_MODEL");
  });

  test("repository docs describe Codex-native PR review setup", () => {
    const readme = readRepoFile("README.md");
    const debugging = readRepoFile("docs/debugging.md");

    expect(readme).toContain("@codex review");
    expect(readme).not.toContain("Add repository secret `OPENAI_API_KEY`");
    expect(debugging).toContain("Codex");
    expect(debugging).not.toContain("Add repository secret `OPENAI_API_KEY`");
  });
});

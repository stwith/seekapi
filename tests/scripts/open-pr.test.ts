import { describe, expect, test } from "vitest";
import {
  buildPrBody,
  normalizeExecOutput,
  parseArgs,
} from "../../scripts/open-pr.js";

describe("open-pr helper", () => {
  test("parseArgs reads title, body-file, and automerge flag", () => {
    const parsed = parseArgs([
      "--title",
      "feat: automate pr loop",
      "--body-file",
      "tmp/pr.md",
      "--automerge",
    ]);

    expect(parsed).toEqual({
      title: "feat: automate pr loop",
      bodyFile: "tmp/pr.md",
      automerge: true,
    });
  });

  test("buildPrBody includes active plan and validation command", () => {
    const body = buildPrBody({
      planFile: "docs/plans/2026-03-20-pr-loop-automation-plan.md",
      validateCommand: "bash scripts/validate.sh",
    });

    expect(body).toContain("active plan file: `docs/plans/2026-03-20-pr-loop-automation-plan.md`");
    expect(body).toContain("- [x] `bash scripts/validate.sh`");
  });

  test("normalizeExecOutput tolerates null from inherited stdio", () => {
    expect(normalizeExecOutput(null)).toBe("");
    expect(normalizeExecOutput("  ok \n")).toBe("ok");
  });
});

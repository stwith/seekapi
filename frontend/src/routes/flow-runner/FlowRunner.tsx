import { useState, useCallback } from "react";
import { api } from "../../lib/api.js";

interface FlowRunnerProps {
  adminKey: string;
}

interface StepResult {
  status: "pending" | "running" | "success" | "failure";
  detail?: string;
  timestamp?: string;
}

const STEP_LABELS = [
  "1. Create Project",
  "2. Attach Brave Credential",
  "3. Enable search.web",
  "4. Mint Key A",
  "5. Mint Key B",
  "6. Search with Key A",
  "7. Search with Key B",
  "8. Disable Key B",
  "9. Verify Key B gets 401",
  "10. Verify Key A still succeeds",
] as const;

export function FlowRunner({ adminKey }: FlowRunnerProps) {
  const [steps, setSteps] = useState<StepResult[]>(
    STEP_LABELS.map(() => ({ status: "pending" as const })),
  );
  const [running, setRunning] = useState(false);
  const [braveSecret, setBraveSecret] = useState("");
  const [searchQuery, setSearchQuery] = useState("seekapi test");

  const updateStep = useCallback(
    (idx: number, result: StepResult) =>
      setSteps((prev) => prev.map((s, i) => (i === idx ? result : s))),
    [],
  );

  async function runFlow() {
    if (!braveSecret.trim()) {
      alert("Enter a Brave API secret to run the flow.");
      return;
    }
    setRunning(true);
    setSteps(STEP_LABELS.map(() => ({ status: "pending" as const })));

    let projectId = "";
    let keyA = "";
    let keyB = "";
    let keyBId = "";

    try {
      // Step 1: Create project
      updateStep(0, { status: "running" });
      const project = await api.createProject(adminKey, `flow-test-${Date.now()}`);
      projectId = project.id;
      updateStep(0, { status: "success", detail: `Project: ${project.id}`, timestamp: new Date().toISOString() });

      // Step 2: Attach Brave credential
      updateStep(1, { status: "running" });
      await api.upsertCredential(adminKey, projectId, "brave", braveSecret.trim());
      updateStep(1, { status: "success", detail: "Brave credential attached", timestamp: new Date().toISOString() });

      // Step 3: Enable search.web
      updateStep(2, { status: "running" });
      await api.configureBinding(adminKey, projectId, {
        provider: "brave",
        capability: "search.web",
        enabled: true,
        priority: 0,
      });
      updateStep(2, { status: "success", detail: "search.web enabled", timestamp: new Date().toISOString() });

      // Step 4: Mint Key A
      updateStep(3, { status: "running" });
      const keyAResult = await api.createApiKey(adminKey, projectId);
      keyA = keyAResult.rawKey;
      updateStep(3, { status: "success", detail: `Key A: ${keyA.slice(0, 12)}...`, timestamp: new Date().toISOString() });

      // Step 5: Mint Key B
      updateStep(4, { status: "running" });
      const keyBResult = await api.createApiKey(adminKey, projectId);
      keyB = keyBResult.rawKey;
      keyBId = keyBResult.id;
      updateStep(4, { status: "success", detail: `Key B: ${keyB.slice(0, 12)}...`, timestamp: new Date().toISOString() });

      // Step 6: Search with Key A
      updateStep(5, { status: "running" });
      const searchA = await api.search(keyA, searchQuery);
      if (searchA.status === 200) {
        updateStep(5, { status: "success", detail: `HTTP ${searchA.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(5, { status: "failure", detail: `HTTP ${searchA.status}`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      // Step 7: Search with Key B
      updateStep(6, { status: "running" });
      const searchB = await api.search(keyB, searchQuery);
      if (searchB.status === 200) {
        updateStep(6, { status: "success", detail: `HTTP ${searchB.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(6, { status: "failure", detail: `HTTP ${searchB.status}`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      // Step 8: Disable Key B
      updateStep(7, { status: "running" });
      await api.disableApiKey(adminKey, keyBId);
      updateStep(7, { status: "success", detail: "Key B disabled", timestamp: new Date().toISOString() });

      // Step 9: Verify Key B gets 401
      updateStep(8, { status: "running" });
      const verifyB = await api.search(keyB, searchQuery);
      if (verifyB.status === 401) {
        updateStep(8, { status: "success", detail: `HTTP ${verifyB.status} (expected)`, timestamp: new Date().toISOString() });
      } else {
        updateStep(8, { status: "failure", detail: `HTTP ${verifyB.status} (expected 401)`, timestamp: new Date().toISOString() });
        setRunning(false);
        return;
      }

      // Step 10: Verify Key A still succeeds
      updateStep(9, { status: "running" });
      const verifyA = await api.search(keyA, searchQuery);
      if (verifyA.status === 200) {
        updateStep(9, { status: "success", detail: `HTTP ${verifyA.status}`, timestamp: new Date().toISOString() });
      } else {
        updateStep(9, { status: "failure", detail: `HTTP ${verifyA.status} (expected 200)`, timestamp: new Date().toISOString() });
      }
    } catch (err: unknown) {
      const currentRunning = steps.findIndex((s) => s.status === "running");
      if (currentRunning >= 0) {
        updateStep(currentRunning, {
          status: "failure",
          detail: (err as Error).message,
          timestamp: new Date().toISOString(),
        });
      }
    } finally {
      setRunning(false);
    }
  }

  const allDone = steps.every((s) => s.status === "success");
  const hasFailed = steps.some((s) => s.status === "failure");

  return (
    <div>
      <h1>Flow Runner</h1>
      <p>Execute the Phase 2.5 Brave-only workflow end to end.</p>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="password"
          value={braveSecret}
          onChange={(e) => setBraveSecret(e.target.value)}
          placeholder="Brave API Secret"
          style={{ padding: 6, width: 250 }}
        />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search query"
          style={{ padding: 6, width: 200 }}
        />
        <button onClick={runFlow} disabled={running}>
          {running ? "Running..." : "Run Flow"}
        </button>
      </div>

      {allDone && (
        <p data-testid="flow-success" style={{ color: "green", fontWeight: 700 }}>
          All 10 steps passed.
        </p>
      )}
      {hasFailed && (
        <p data-testid="flow-failure" style={{ color: "red", fontWeight: 700 }}>
          Flow failed. See details below.
        </p>
      )}

      <table data-testid="flow-steps" style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>Step</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>Status</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>Detail</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "2px solid #ddd" }}>Time</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step, i) => (
            <tr key={i}>
              <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>{STEP_LABELS[i]}</td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                <span
                  style={{
                    color:
                      step.status === "success"
                        ? "green"
                        : step.status === "failure"
                          ? "red"
                          : step.status === "running"
                            ? "orange"
                            : "#999",
                  }}
                >
                  {step.status}
                </span>
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee", fontFamily: "monospace", fontSize: 12 }}>
                {step.detail ?? "—"}
              </td>
              <td style={{ padding: 8, borderBottom: "1px solid #eee", fontSize: 12 }}>
                {step.timestamp ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

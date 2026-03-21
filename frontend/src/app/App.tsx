import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Shell } from "../components/layout/Shell.js";
import { Overview } from "../routes/overview/Overview.js";
import { ProjectList } from "../routes/projects/ProjectList.js";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";
import { FlowRunner } from "../routes/flow-runner/FlowRunner.js";

export function App() {
  const [adminKey, setAdminKey] = useState(
    () => localStorage.getItem("seekapi_admin_key") ?? "",
  );

  function handleSetAdminKey(key: string) {
    setAdminKey(key);
    if (key) {
      localStorage.setItem("seekapi_admin_key", key);
    } else {
      localStorage.removeItem("seekapi_admin_key");
    }
  }

  if (!adminKey) {
    return <LoginGate onSubmit={handleSetAdminKey} />;
  }

  return (
    <BrowserRouter>
      <Shell adminKey={adminKey} onLogout={() => handleSetAdminKey("")}>
        <Routes>
          <Route path="/" element={<Overview adminKey={adminKey} />} />
          <Route path="/projects" element={<ProjectList adminKey={adminKey} />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage adminKey={adminKey} />} />
          <Route path="/flow-runner" element={<FlowRunner adminKey={adminKey} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  );
}

function LoginGate({ onSubmit }: { onSubmit: (key: string) => void }) {
  const [key, setKey] = useState("");
  return (
    <div style={{ maxWidth: 400, margin: "120px auto", fontFamily: "system-ui" }}>
      <h1>SeekAPI Operator Console</h1>
      <p>Enter your Admin API Key to continue.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) onSubmit(key.trim());
        }}
      >
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="ADMIN_API_KEY"
          style={{ width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" }}
        />
        <button type="submit" style={{ padding: "8px 24px" }}>
          Connect
        </button>
      </form>
    </div>
  );
}

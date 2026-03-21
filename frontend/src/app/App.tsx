import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Shell } from "../components/layout/Shell.js";
import { Overview } from "../routes/overview/Overview.js";
import { ProjectList } from "../routes/projects/ProjectList.js";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";
import { FlowRunner } from "../routes/flow-runner/FlowRunner.js";

export function App() {
  const [adminKey, setAdminKey] = useState(
    () => sessionStorage.getItem("seekapi_admin_key") ?? "",
  );

  function handleSetAdminKey(key: string) {
    setAdminKey(key);
    if (key) {
      sessionStorage.setItem("seekapi_admin_key", key);
    } else {
      sessionStorage.removeItem("seekapi_admin_key");
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
    <div className="max-w-md mx-auto mt-32 font-sans text-gray-200">
      <h1 className="text-2xl font-bold text-white">SeekAPI Operator Console</h1>
      <p className="text-gray-400 mt-2">Enter your Admin API Key to continue.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (key.trim()) onSubmit(key.trim());
        }}
        className="mt-4"
      >
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="ADMIN_API_KEY"
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 mb-3"
        />
        <button
          type="submit"
          className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded"
        >
          Connect
        </button>
      </form>
    </div>
  );
}

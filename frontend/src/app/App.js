import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Shell } from "../components/layout/Shell.js";
import { Overview } from "../routes/overview/Overview.js";
import { ProjectList } from "../routes/projects/ProjectList.js";
import { ProjectDetailPage } from "../routes/projects/ProjectDetail.js";
import { FlowRunner } from "../routes/flow-runner/FlowRunner.js";
export function App() {
    const [adminKey, setAdminKey] = useState(() => localStorage.getItem("seekapi_admin_key") ?? "");
    function handleSetAdminKey(key) {
        setAdminKey(key);
        if (key) {
            localStorage.setItem("seekapi_admin_key", key);
        }
        else {
            localStorage.removeItem("seekapi_admin_key");
        }
    }
    if (!adminKey) {
        return _jsx(LoginGate, { onSubmit: handleSetAdminKey });
    }
    return (_jsx(BrowserRouter, { children: _jsx(Shell, { adminKey: adminKey, onLogout: () => handleSetAdminKey(""), children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Overview, { adminKey: adminKey }) }), _jsx(Route, { path: "/projects", element: _jsx(ProjectList, { adminKey: adminKey }) }), _jsx(Route, { path: "/projects/:projectId", element: _jsx(ProjectDetailPage, { adminKey: adminKey }) }), _jsx(Route, { path: "/flow-runner", element: _jsx(FlowRunner, { adminKey: adminKey }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }) }) }));
}
function LoginGate({ onSubmit }) {
    const [key, setKey] = useState("");
    return (_jsxs("div", { style: { maxWidth: 400, margin: "120px auto", fontFamily: "system-ui" }, children: [_jsx("h1", { children: "SeekAPI Operator Console" }), _jsx("p", { children: "Enter your Admin API Key to continue." }), _jsxs("form", { onSubmit: (e) => {
                    e.preventDefault();
                    if (key.trim())
                        onSubmit(key.trim());
                }, children: [_jsx("input", { type: "password", value: key, onChange: (e) => setKey(e.target.value), placeholder: "ADMIN_API_KEY", style: { width: "100%", padding: 8, marginBottom: 12, boxSizing: "border-box" } }), _jsx("button", { type: "submit", style: { padding: "8px 24px" }, children: "Connect" })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
export function Overview({ adminKey }) {
    const [projects, setProjects] = useState([]);
    const [healthy, setHealthy] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        // Check health
        fetch("/v1/health")
            .then((r) => setHealthy(r.ok))
            .catch(() => setHealthy(false));
        // Load projects
        api
            .listProjects(adminKey)
            .then(setProjects)
            .catch((e) => setError(e.message));
    }, [adminKey]);
    return (_jsxs("div", { children: [_jsx("h1", { children: "Overview" }), _jsxs("section", { style: { marginBottom: 24 }, children: [_jsx("h2", { children: "Server Status" }), _jsx("p", { "data-testid": "health-status", children: healthy === null ? "Checking..." : healthy ? "Connected" : "Unreachable" })] }), _jsxs("section", { children: [_jsxs("h2", { children: ["Projects (", projects.length, ")"] }), error && _jsx("p", { style: { color: "red" }, children: error }), projects.length === 0 && !error && _jsx("p", { children: "No projects yet." }), _jsx("ul", { children: projects.map((p) => (_jsxs("li", { children: [p.name, " (", p.status, ")"] }, p.id))) })] })] }));
}

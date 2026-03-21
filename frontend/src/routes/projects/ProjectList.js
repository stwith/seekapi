import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api.js";
export function ProjectList({ adminKey }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);
    async function loadProjects() {
        try {
            const list = await api.listProjects(adminKey);
            setProjects(list);
            setError(null);
        }
        catch (e) {
            setError(e.message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        void loadProjects();
    }, [adminKey]);
    async function handleCreate(e) {
        e.preventDefault();
        if (!newName.trim())
            return;
        setCreating(true);
        try {
            await api.createProject(adminKey, newName.trim());
            setNewName("");
            await loadProjects();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setCreating(false);
        }
    }
    return (_jsxs("div", { children: [_jsx("h1", { children: "Projects" }), _jsxs("form", { onSubmit: handleCreate, style: { marginBottom: 16 }, children: [_jsx("input", { value: newName, onChange: (e) => setNewName(e.target.value), placeholder: "New project name", style: { padding: 6, marginRight: 8 } }), _jsx("button", { type: "submit", disabled: creating, children: creating ? "Creating..." : "Create Project" })] }), error && _jsx("p", { style: { color: "red" }, children: error }), loading && _jsx("p", { children: "Loading..." }), !loading && projects.length === 0 && _jsx("p", { children: "No projects yet." }), _jsxs("table", { "data-testid": "projects-table", style: { borderCollapse: "collapse", width: "100%" }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }, children: "Name" }), _jsx("th", { style: { textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }, children: "Status" }), _jsx("th", { style: { textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }, children: "ID" })] }) }), _jsx("tbody", { children: projects.map((p) => (_jsxs("tr", { children: [_jsx("td", { style: { padding: 8, borderBottom: "1px solid #eee" }, children: _jsx(Link, { to: `/projects/${p.id}`, children: p.name }) }), _jsx("td", { style: { padding: 8, borderBottom: "1px solid #eee" }, children: p.status }), _jsx("td", { style: { padding: 8, borderBottom: "1px solid #eee", fontFamily: "monospace", fontSize: 12 }, children: p.id })] }, p.id))) })] })] }));
}

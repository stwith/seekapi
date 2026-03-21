import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../lib/api.js";
export function ProjectDetailPage({ adminKey }) {
    const { projectId } = useParams();
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    // Credential form
    const [secret, setSecret] = useState("");
    const [credSubmitting, setCredSubmitting] = useState(false);
    // Binding form
    const [bindCap, setBindCap] = useState("search.web");
    const [bindEnabled, setBindEnabled] = useState(true);
    // Key management
    const [revealedKey, setRevealedKey] = useState(null);
    const [mintingKey, setMintingKey] = useState(false);
    async function loadDetail() {
        if (!projectId)
            return;
        try {
            const d = await api.getProjectDetail(adminKey, projectId);
            setDetail(d);
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
        void loadDetail();
    }, [adminKey, projectId]);
    if (loading)
        return _jsx("p", { children: "Loading..." });
    if (error)
        return _jsx("p", { style: { color: "red" }, children: error });
    if (!detail)
        return _jsx("p", { children: "Project not found." });
    const { project, bindings, keys, credential } = detail;
    async function handleAttachCredential(e) {
        e.preventDefault();
        if (!projectId || !secret.trim())
            return;
        setCredSubmitting(true);
        try {
            await api.upsertCredential(adminKey, projectId, "brave", secret.trim());
            setSecret("");
            await loadDetail();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setCredSubmitting(false);
        }
    }
    async function handleConfigureBinding(e) {
        e.preventDefault();
        if (!projectId)
            return;
        try {
            await api.configureBinding(adminKey, projectId, {
                provider: "brave",
                capability: bindCap,
                enabled: bindEnabled,
                priority: 0,
            });
            await loadDetail();
        }
        catch (err) {
            setError(err.message);
        }
    }
    async function handleMintKey() {
        if (!projectId)
            return;
        setMintingKey(true);
        try {
            const result = await api.createApiKey(adminKey, projectId);
            setRevealedKey(result);
            await loadDetail();
        }
        catch (err) {
            setError(err.message);
        }
        finally {
            setMintingKey(false);
        }
    }
    async function handleDisableKey(keyId) {
        try {
            await api.disableApiKey(adminKey, keyId);
            await loadDetail();
        }
        catch (err) {
            setError(err.message);
        }
    }
    return (_jsxs("div", { children: [_jsx(Link, { to: "/projects", children: "\u2190 Projects" }), _jsx("h1", { children: project.name }), _jsxs("p", { children: ["Status: ", _jsx("strong", { children: project.status }), " \u00B7 ID:", " ", _jsx("code", { children: project.id })] }), _jsxs("section", { style: { marginTop: 24 }, children: [_jsx("h2", { children: "Brave Credential" }), credential ? (_jsxs("p", { children: ["Provider: ", _jsx("strong", { children: credential.provider }), " \u00B7 Status:", " ", _jsx("strong", { children: credential.status }), " \u00B7 ID: ", _jsx("code", { children: credential.id })] })) : (_jsx("p", { children: "No credential attached." })), _jsxs("form", { onSubmit: handleAttachCredential, children: [_jsx("input", { type: "password", value: secret, onChange: (e) => setSecret(e.target.value), placeholder: "Brave API secret", style: { padding: 6, marginRight: 8, width: 300 } }), _jsx("button", { type: "submit", disabled: credSubmitting, children: credential ? "Rotate" : "Attach" })] })] }), _jsxs("section", { style: { marginTop: 24 }, children: [_jsx("h2", { children: "Capability Bindings" }), bindings.length === 0 && _jsx("p", { children: "No bindings configured." }), _jsxs("table", { "data-testid": "bindings-table", style: { borderCollapse: "collapse", marginBottom: 12 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Capability" }), _jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Provider" }), _jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Enabled" }), _jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Priority" })] }) }), _jsx("tbody", { children: bindings.map((b) => (_jsxs("tr", { children: [_jsx("td", { style: { padding: 6 }, children: b.capability }), _jsx("td", { style: { padding: 6 }, children: b.provider }), _jsx("td", { style: { padding: 6 }, children: b.enabled ? "Yes" : "No" }), _jsx("td", { style: { padding: 6 }, children: b.priority })] }, `${b.provider}-${b.capability}`))) })] }), _jsxs("form", { onSubmit: handleConfigureBinding, style: { display: "flex", gap: 8, alignItems: "center" }, children: [_jsxs("select", { value: bindCap, onChange: (e) => setBindCap(e.target.value), children: [_jsx("option", { value: "search.web", children: "search.web" }), _jsx("option", { value: "search.news", children: "search.news" }), _jsx("option", { value: "search.images", children: "search.images" })] }), _jsxs("label", { children: [_jsx("input", { type: "checkbox", checked: bindEnabled, onChange: (e) => setBindEnabled(e.target.checked) }), " ", "Enabled"] }), _jsx("button", { type: "submit", children: "Configure" })] })] }), _jsxs("section", { style: { marginTop: 24 }, children: [_jsx("h2", { children: "API Keys" }), _jsx("button", { onClick: handleMintKey, disabled: mintingKey, style: { marginBottom: 12 }, children: mintingKey ? "Minting..." : "Mint New Key" }), revealedKey && (_jsxs("div", { "data-testid": "revealed-key", style: {
                            background: "#fff3cd",
                            border: "1px solid #ffc107",
                            padding: 12,
                            marginBottom: 12,
                        }, children: [_jsx("strong", { children: "New API Key (shown once only):" }), _jsx("pre", { style: { margin: "8px 0", userSelect: "all" }, children: revealedKey.rawKey }), _jsx("p", { style: { margin: 0, fontSize: 12, color: "#856404" }, children: "Copy this key now. It cannot be retrieved later." }), _jsx("button", { onClick: () => setRevealedKey(null), style: { marginTop: 8 }, children: "Dismiss" })] })), keys.length === 0 && _jsx("p", { children: "No keys issued." }), _jsxs("table", { "data-testid": "keys-table", style: { borderCollapse: "collapse" }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Key ID" }), _jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Status" }), _jsx("th", { style: { textAlign: "left", padding: 6 }, children: "Actions" })] }) }), _jsx("tbody", { children: keys.map((k) => (_jsxs("tr", { children: [_jsx("td", { style: { padding: 6, fontFamily: "monospace", fontSize: 12 }, children: k.id }), _jsx("td", { style: { padding: 6 }, children: _jsx("span", { style: { color: k.status === "active" ? "green" : "red" }, children: k.status }) }), _jsx("td", { style: { padding: 6 }, children: k.status === "active" && (_jsx("button", { onClick: () => handleDisableKey(k.id), children: "Disable" })) })] }, k.id))) })] })] })] }));
}

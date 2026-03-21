import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from "react-router-dom";
const NAV_ITEMS = [
    { to: "/", label: "Overview" },
    { to: "/projects", label: "Projects" },
    { to: "/flow-runner", label: "Flow Runner" },
];
export function Shell({ onLogout, children }) {
    return (_jsxs("div", { style: { display: "flex", minHeight: "100vh", fontFamily: "system-ui" }, children: [_jsxs("nav", { "data-testid": "nav-sidebar", style: {
                    width: 200,
                    background: "#1a1a2e",
                    color: "#eee",
                    padding: "16px 0",
                    display: "flex",
                    flexDirection: "column",
                }, children: [_jsx("div", { style: { padding: "0 16px 16px", fontWeight: 700, fontSize: 14 }, children: "SeekAPI Console" }), NAV_ITEMS.map((item) => (_jsx(NavLink, { to: item.to, end: item.to === "/", style: ({ isActive }) => ({
                            display: "block",
                            padding: "8px 16px",
                            color: isActive ? "#fff" : "#aaa",
                            background: isActive ? "#16213e" : "transparent",
                            textDecoration: "none",
                            fontSize: 14,
                        }), children: item.label }, item.to))), _jsx("div", { style: { flex: 1 } }), _jsx("button", { onClick: onLogout, style: {
                            margin: "8px 16px",
                            padding: "6px 12px",
                            background: "transparent",
                            border: "1px solid #555",
                            color: "#aaa",
                            cursor: "pointer",
                            fontSize: 12,
                        }, children: "Disconnect" })] }), _jsx("main", { style: { flex: 1, padding: 24 }, children: children })] }));
}

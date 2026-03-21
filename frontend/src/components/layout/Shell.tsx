import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Overview" },
  { to: "/projects", label: "Projects" },
  { to: "/flow-runner", label: "Flow Runner" },
];

interface ShellProps {
  adminKey: string;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ onLogout, children }: ShellProps) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "system-ui" }}>
      <nav
        data-testid="nav-sidebar"
        style={{
          width: 200,
          background: "#1a1a2e",
          color: "#eee",
          padding: "16px 0",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: "0 16px 16px", fontWeight: 700, fontSize: 14 }}>
          SeekAPI Console
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            style={({ isActive }) => ({
              display: "block",
              padding: "8px 16px",
              color: isActive ? "#fff" : "#aaa",
              background: isActive ? "#16213e" : "transparent",
              textDecoration: "none",
              fontSize: 14,
            })}
          >
            {item.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <button
          onClick={onLogout}
          style={{
            margin: "8px 16px",
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid #555",
            color: "#aaa",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Disconnect
        </button>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}

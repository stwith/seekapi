import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/", label: "Overview" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Projects" },
  { to: "/keys", label: "API Keys" },
  { to: "/usage", label: "Usage" },
  { to: "/providers", label: "Providers" },
  { to: "/subscriptions", label: "Subscriptions" },
  { to: "/flow-runner", label: "Flow Runner" },
];

interface ShellProps {
  adminKey: string;
  onLogout: () => void;
  children: ReactNode;
}

export function Shell({ onLogout, children }: ShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen font-sans bg-gray-950 text-gray-200">
      {/* Mobile hamburger */}
      <button
        data-testid="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-gray-800 rounded text-gray-300"
        aria-label="Toggle sidebar"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav
        data-testid="nav-sidebar"
        className={`
          fixed md:static z-40 h-full md:h-auto
          w-52 bg-sidebar flex flex-col py-4
          transition-transform md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-4 pb-4 font-bold text-sm text-gray-100">
          SeekAPI Console
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `block px-4 py-2 text-sm no-underline transition-colors ${
                isActive
                  ? "text-white bg-sidebar-active"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
        <div className="flex-1" />
        <button
          onClick={onLogout}
          className="mx-4 px-3 py-1.5 bg-transparent border border-gray-600 text-gray-400 text-xs rounded cursor-pointer hover:border-gray-400 hover:text-gray-200 transition-colors"
        >
          Disconnect
        </button>
      </nav>
      <main className="flex-1 p-6 md:p-6 pt-14 md:pt-6">{children}</main>
    </div>
  );
}

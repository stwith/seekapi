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
    <div className="flex min-h-screen font-sans bg-gray-950 text-gray-200">
      <nav
        data-testid="nav-sidebar"
        className="w-52 bg-sidebar flex flex-col py-4"
      >
        <div className="px-4 pb-4 font-bold text-sm text-gray-100">
          SeekAPI Console
        </div>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
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
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}

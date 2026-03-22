import { useState, useEffect, type ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  KeyRound,
  Activity,
  Plug,
  CreditCard,
  Play,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Sun,
  Moon,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/shadcn/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/shadcn/tooltip";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/shadcn/sheet";

const NAV_ITEMS = [
  { to: "/", labelKey: "nav.overview", icon: LayoutDashboard },
  { to: "/dashboard", labelKey: "nav.dashboard", icon: BarChart3 },
  { to: "/projects", labelKey: "nav.projects", icon: FolderKanban },
  { to: "/keys", labelKey: "nav.apiKeys", icon: KeyRound },
  { to: "/usage", labelKey: "nav.usage", icon: Activity },
  { to: "/providers", labelKey: "nav.providers", icon: Plug },
  { to: "/subscriptions", labelKey: "nav.subscriptions", icon: CreditCard },
  { to: "/flow-runner", labelKey: "nav.flowRunner", icon: Play },
];

interface ShellProps {
  adminKey: string;
  onLogout: () => void;
  children: ReactNode;
}

function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return true;
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);

  return { dark, toggle: () => setDark((d) => !d) };
}

function CollapsedNavItem({
  item,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number];
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const location = useLocation();
  const isActive =
    item.to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(item.to);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={cn(
            "relative flex items-center justify-center rounded-md size-9 mx-auto transition-colors",
            isActive
              ? "bg-sidebar-accent text-primary"
              : "text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <item.icon className="size-4" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {t(item.labelKey)}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarNav({
  collapsed,
  onNavigate,
  onLogout,
  onToggleCollapse,
  theme,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onLogout: () => void;
  onToggleCollapse?: () => void;
  theme: { dark: boolean; toggle: () => void };
}) {
  const { t, i18n } = useTranslation();

  function toggleLang() {
    const next = i18n.language === "zh" ? "en" : "zh";
    i18n.changeLanguage(next);
    localStorage.setItem("seekapi_lang", next);
  }

  return (
    <TooltipProvider delayDuration={0}>
      {/* Logo */}
      <div className={cn("pb-4 pt-1", collapsed ? "px-2 text-center" : "px-4")}>
        <span className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          {collapsed ? "S" : "SeekAPI"}
        </span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-2" data-testid="nav-sidebar">
        {NAV_ITEMS.map((item) =>
          collapsed ? (
            <CollapsedNavItem key={item.to} item={item} onNavigate={onNavigate} />
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-foreground"
                    : "border-l-2 border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )
              }
            >
              <item.icon className="size-4 shrink-0" />
              {t(item.labelKey)}
            </NavLink>
          ),
        )}
      </nav>

      {/* Footer actions */}
      <div className="mt-auto px-2 pb-4 space-y-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={onLogout}
          className={cn(
            "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "justify-start gap-2",
          )}
        >
          <LogOut className="size-4 shrink-0" />
          {!collapsed && t("nav.disconnect")}
        </Button>

        {/* Collapse toggle (desktop only) */}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className={cn(
              "w-full text-sidebar-foreground/70 hover:text-sidebar-foreground",
              collapsed ? "justify-center px-0" : "justify-start gap-2",
            )}
          >
            {collapsed ? <PanelLeft className="size-4 shrink-0" /> : <PanelLeftClose className="size-4 shrink-0" />}
            {!collapsed && t("nav.collapse")}
          </Button>
        )}

        {/* Settings row with lang + theme toggles */}
        {collapsed ? (
          <div className="flex flex-col gap-1 items-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleLang}
                  className="w-full justify-center px-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  <span className="text-xs font-semibold">{i18n.language === "zh" ? "EN" : "\u4e2d"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {i18n.language === "zh" ? "English" : "\u4e2d\u6587"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={theme.toggle}
                  className="w-full justify-center px-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
                >
                  {theme.dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {theme.dark ? t("nav.lightMode") : t("nav.darkMode")}
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full px-3 py-1.5">
            <div className="flex items-center gap-2 text-sidebar-foreground/70">
              <Settings className="size-4 shrink-0" />
              <span className="text-sm font-medium">{t("nav.settings")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleLang}
                className="size-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <span className="text-xs font-semibold">{i18n.language === "zh" ? "EN" : "\u4e2d"}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={theme.toggle}
                className="size-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                {theme.dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export function Shell({ onLogout, children }: ShellProps) {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const theme = useTheme();

  return (
    <div className="flex min-h-[100dvh]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex shrink-0 flex-col bg-sidebar-background border-r border-sidebar-border transition-[width] duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        <div className="flex flex-col h-full py-4">
          <SidebarNav
            collapsed={collapsed}
            onLogout={onLogout}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            theme={theme}
          />
        </div>
      </aside>

      {/* Mobile sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            data-testid="sidebar-toggle"
            variant="ghost"
            size="icon"
            className="md:hidden fixed top-3 left-3 z-50"
            aria-label={t("nav.toggleSidebar")}
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-56 bg-sidebar-background p-0 pt-4"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">{t("nav.navigation")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("nav.mainNavSidebar")}
          </SheetDescription>
          <SidebarNav
            onNavigate={() => setSheetOpen(false)}
            onLogout={onLogout}
            theme={theme}
          />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="flex-1 min-h-[100dvh] overflow-auto">
        <div className="p-6 md:p-8 pt-16 md:pt-8">{children}</div>
      </main>
    </div>
  );
}

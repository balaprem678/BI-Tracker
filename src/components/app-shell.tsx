import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  Clock,
  FolderKanban,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SessionInfo } from "@/lib/tracker.functions";

export function AppShell({
  session,
  children,
}: {
  session: SessionInfo;
  children: React.ReactNode;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  useEffect(() => {
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const msUntilDayEnd = endOfDay.getTime() - now.getTime();
    const waitMs = msUntilDayEnd > 0 ? msUntilDayEnd : 0;

    const timer = window.setTimeout(() => {
      void signOut();
    }, waitMs);

    return () => window.clearTimeout(timer);
  }, [session.userId, signOut]);

  const nav =
    session.role === "sub_admin"
      ? [{ to: "/project", label: "Project", icon: FolderKanban }]
      : [
          { to: "/dashboard", label: "Dashboard", icon: Clock },
          { to: "/project", label: "Project", icon: FolderKanban },
          ...(session.role === "admin"
            ? [{ to: "/team", label: "Team", icon: Users }]
            : []),
          { to: "/leave", label: "Leave", icon: CalendarDays },
          { to: "/settings", label: "Setting", icon: Settings },
        ];

  const tabs =
    session.role === "sub_admin"
      ? [{ to: "/project", label: "Project", icon: FolderKanban }]
      : [
          { to: "/dashboard", label: "My Shift", icon: Clock },
          ...(session.role === "admin"
            ? [
                { to: "/team", label: "Team", icon: Users },
                { to: "/admin", label: "Admin Panel", icon: ShieldCheck },
              ]
            : []),
        ];


  const initials =
    (session.fullName || session.email || "U")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U";

  const sidebar = (
    <div className="flex h-full flex-col gap-2 border-r border-border bg-sidebar p-3">
      <div className="flex items-center gap-2 px-1 py-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
          <LayoutGrid className="size-4" />
        </span>
        {!collapsed && (
          <span className="truncate font-display text-base font-semibold tracking-tight">
            BI Tracker
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="ml-auto hidden size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:grid"
        >
          {collapsed ? <Menu className="size-4" /> : <ChevronLeft className="size-4" />}
        </button>
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Close sidebar"
          className="ml-auto grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => {
          const active = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              title={item.label}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={signOut}
        title="Logout"
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive ${
          collapsed ? "justify-center px-2" : ""
        }`}
      >
        <LogOut className="size-4 shrink-0" />
        {!collapsed && <span>Logout</span>}
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside
        className={`hidden shrink-0 lg:block ${collapsed ? "w-[4.5rem]" : "w-64"} transition-[width] duration-200`}
      >
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/30"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
              className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
            >
              <Menu className="size-4" />
            </button>

            <nav className="flex items-center gap-1 rounded-md border border-border bg-secondary/40 p-1">
              {tabs.map((tab) => {
                const active = pathname.startsWith(tab.to);
                return (
                  <Link
                    key={tab.to}
                    to={tab.to}
                    className={`flex items-center gap-2 rounded px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                      active
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </Link>
                );
              })}
            </nav>



            <Link
              to="/profile"
              className="ml-auto flex min-w-0 items-center gap-3 rounded-md border border-border px-2 py-1.5 transition-colors hover:bg-secondary"
            >
              <div className="hidden min-w-0 text-right sm:block">
                <p className="truncate text-sm leading-tight">
                  {session.fullName || session.email}
                </p>
                <p className="text-xs uppercase tracking-widest text-primary">
                  {session.role === "sub_admin" ? "SUB ADMIN" : session.role}
                </p>
              </div>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </span>
              <UserRound className="size-4 shrink-0 text-muted-foreground sm:hidden" />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export function Panel({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-muted-foreground/80">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="panel p-5">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="stat-number mt-2 text-3xl font-semibold text-foreground">
        {value}
        {suffix && <span className="ml-1 text-base text-muted-foreground">{suffix}</span>}
      </p>
    </div>
  );
}

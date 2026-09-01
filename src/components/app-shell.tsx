import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
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
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SessionInfo } from "@/lib/tracker.functions";
import { getPendingLeaveNotifications } from "@/lib/leave.functions";

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
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const getPendingNotifsFn = useServerFn(getPendingLeaveNotifications);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }, [navigate, queryClient]);

  // Real-time Pending Leave Notifications Query (for Admins)
  const isAdmin = session.role === "admin";
  const prevCountRef = useRef<number | null>(null);

  const { data: notifData } = useQuery({
    queryKey: ["pending-leave-notifications"],
    queryFn: () => getPendingNotifsFn({}),
    enabled: isAdmin,
    refetchInterval: 6000, // Poll every 6 seconds
  });

  const pendingCount = notifData?.pendingCount ?? 0;
  const recentPending = notifData?.recentPending ?? [];

  // Trigger real-time toast alert when new leave request arrives
  useEffect(() => {
    if (!isAdmin || !notifData) return;

    if (prevCountRef.current !== null && pendingCount > prevCountRef.current) {
      const newest = recentPending[0];
      toast.info(
        `🔔 New Leave Request: ${newest?.employee_name || "An employee"} requested ${newest?.leave_type || "time off"}`,
        {
          description: `${newest?.start_date} to ${newest?.end_date}`,
          action: {
            label: "Review",
            onClick: () => navigate({ to: "/admin/leave" }),
          },
          duration: 7000,
        },
      );
    }
    prevCountRef.current = pendingCount;
  }, [pendingCount, recentPending, isAdmin, navigate, notifData]);

  // Close notifications dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifOpen]);

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
      : session.role === "admin"
        ? [
            { to: "/admin", label: "Admin Panel", icon: ShieldCheck },
            { to: "/admin/leave", label: "Leave Requests", icon: CalendarDays, badge: pendingCount > 0 ? pendingCount : undefined },
            { to: "/team", label: "IT Team", icon: Users },
            { to: "/bi-staff", label: "BI Staff", icon: UserRound },
            { to: "/project", label: "Project", icon: FolderKanban },
            { to: "/settings", label: "Setting", icon: Settings },
          ]
        : [
            { to: "/dashboard", label: "Dashboard", icon: Clock },
            { to: "/project", label: "Project", icon: FolderKanban },
            { to: "/leave", label: "Leave", icon: CalendarDays },
            { to: "/settings", label: "Setting", icon: Settings },
          ];

  const tabs =
    session.role === "sub_admin"
      ? [{ to: "/project", label: "Project", icon: FolderKanban }]
      : session.role === "admin"
        ? [
            { to: "/admin", label: "Admin Panel", icon: ShieldCheck },
            { to: "/admin/leave", label: "Leaves", icon: CalendarDays, badge: pendingCount > 0 ? pendingCount : undefined },
            { to: "/team", label: "IT Team", icon: Users },
            { to: "/bi-staff", label: "BI Staff", icon: UserRound },
            { to: "/project", label: "Project", icon: FolderKanban },
          ]
        : [
            { to: "/dashboard", label: "My Shift", icon: Clock },
            { to: "/project", label: "Project", icon: FolderKanban },
            { to: "/leave", label: "Leave", icon: CalendarDays },
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
              <div className="relative">
                <item.icon className="size-4 shrink-0" />
                {item.badge !== undefined && item.badge > 0 && collapsed && (
                  <span className="absolute -right-1 -top-1 size-2 rounded-full bg-destructive" />
                )}
              </div>
              {!collapsed && (
                <div className="flex flex-1 items-center justify-between">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 py-0.2 text-[10px] font-bold text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
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
                    {tab.badge !== undefined && tab.badge > 0 && (
                      <span className="ml-0.5 rounded-full bg-destructive px-1.5 py-0.2 text-[10px] font-bold text-destructive-foreground">
                        {tab.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-2.5">
              {/* ADMIN REALTIME NOTIFICATION BELL */}
              {isAdmin && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setNotifOpen((o) => !o)}
                    aria-label="Leave notifications"
                    className="relative grid size-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
                  >
                    <Bell className="size-4" />
                    {pendingCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-bounce">
                        {pendingCount}
                      </span>
                    )}
                  </button>

                  {/* NOTIFICATIONS DROPDOWN POPOVER */}
                  {notifOpen && (
                    <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between border-b border-border/60 pb-3">
                        <div className="flex items-center gap-2">
                          <Bell className="size-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">
                            Leave Notifications
                          </h4>
                        </div>
                        {pendingCount > 0 ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {pendingCount} Pending
                          </span>
                        ) : (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                            All Caught Up
                          </span>
                        )}
                      </div>

                      <div className="max-h-72 divide-y divide-border/40 overflow-y-auto py-2">
                        {recentPending.length === 0 ? (
                          <div className="py-8 text-center text-xs text-muted-foreground">
                            No pending leave requests right now.
                          </div>
                        ) : (
                          recentPending.map((item) => (
                            <div
                              key={item.id}
                              className="group flex flex-col gap-1 py-2.5 transition-colors hover:bg-muted/30 rounded-lg px-2"
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-foreground">
                                  {item.employee_name}
                                </span>
                                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-secondary-foreground">
                                  {item.leave_type}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-1">
                                {item.reason || "No reason specified"}
                              </p>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>
                                  {item.start_date} → {item.end_date}
                                </span>
                                <Link
                                  to="/admin/leave"
                                  onClick={() => setNotifOpen(false)}
                                  className="font-semibold text-primary hover:underline"
                                >
                                  Review Request →
                                </Link>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t border-border/60 pt-2 text-center">
                        <Link
                          to="/admin/leave"
                          onClick={() => setNotifOpen(false)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          View All Leave Requests
                          <ArrowRight className="size-3" />
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* USER PROFILE BUTTON */}
              <Link
                to="/profile"
                className="flex min-w-0 items-center gap-3 rounded-md border border-border px-2 py-1.5 transition-colors hover:bg-secondary"
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

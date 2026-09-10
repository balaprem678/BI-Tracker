import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Search,
  ArrowRight,
  Users,
  UserCheck,
  UserPlus,
  ShieldCheck,
  CalendarDays,
  FolderKanban,
  Settings,
  Clock,
  CheckCircle2,
  X,
  Sparkles,
  CornerDownLeft,
  Briefcase,
} from "lucide-react";
import { listEmployees, type Employee } from "@/lib/admin.functions";
import { getMyProjects, type Project } from "@/lib/project.functions";
import { getAllLeaveRequests, type LeaveRequest } from "@/lib/leave.functions";

export type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  category: "Pages & Sections" | "Employees" | "Projects" | "Leave Requests" | "Quick Actions";
  badge?: string;
  badgeColor?: string;
  to: string;
  actionId?: string;
  icon?: React.ComponentType<{ className?: string }>;
  avatarText?: string;
  isClockedIn?: boolean;
};

const STATIC_SECTIONS: SearchItem[] = [
  {
    id: "sec-admin",
    title: "Admin Console",
    subtitle: "Account issuance, workforce stats, and system administration",
    category: "Pages & Sections",
    badge: "Console",
    badgeColor: "bg-primary/10 text-primary border-primary/20",
    to: "/admin",
    icon: ShieldCheck,
  },
  {
    id: "sec-team",
    title: "IT Team Section",
    subtitle: "IT staff roster, live shift tracking, and daily work reports",
    category: "Pages & Sections",
    badge: "IT Team",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    to: "/team",
    icon: Users,
  },
  {
    id: "sec-bi-staff",
    title: "BI Staff Section",
    subtitle: "BI workforce management, live clock-ins, and shift metrics",
    category: "Pages & Sections",
    badge: "BI Staff",
    badgeColor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    to: "/bi-staff",
    icon: UserCheck,
  },
  {
    id: "sec-leaves",
    title: "Leave Requests & Approvals",
    subtitle: "Review pending employee leaves, grant approvals, or view records",
    category: "Pages & Sections",
    badge: "Leaves",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    to: "/admin/leave",
    icon: CalendarDays,
  },
  {
    id: "sec-projects",
    title: "Projects & Tasks",
    subtitle: "Project assignments, progress tracking, and daily active sessions",
    category: "Pages & Sections",
    badge: "Projects",
    badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    to: "/project",
    icon: FolderKanban,
  },
  {
    id: "sec-settings",
    title: "Settings & Customization",
    subtitle: "System color themes, appearance, and dashboard preferences",
    category: "Pages & Sections",
    badge: "Settings",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    to: "/settings",
    icon: Settings,
  },
];

const QUICK_ACTIONS: SearchItem[] = [
  {
    id: "act-create",
    title: "Create Employee Account",
    subtitle: "Issue new workforce login credentials directly in Admin Console",
    category: "Quick Actions",
    badge: "Action",
    badgeColor: "bg-primary text-primary-foreground",
    to: "/admin",
    actionId: "focus-create-form",
    icon: UserPlus,
  },
  {
    id: "act-live-shifts",
    title: "View Active Clocked-in Staff",
    subtitle: "Check currently active staff members and their GPS locations",
    category: "Quick Actions",
    badge: "Live Shifts",
    badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    to: "/team",
    icon: Clock,
  },
  {
    id: "act-review-pending",
    title: "Review Pending Leave Applications",
    subtitle: "Jump to pending leave requests awaiting approval",
    category: "Quick Actions",
    badge: "Pending",
    badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    to: "/admin/leave",
    icon: CheckCircle2,
  },
];

export function AdminSearchBar({
  className = "",
  placeholder = "Search anything... (Ctrl+K)",
  autoFocus = false,
  onClose,
}: {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus if requested (e.g. mobile search modal/toggle)
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setIsOpen(true);
    }
  }, [autoFocus]);

  // Data fetching
  const employeesFn = useServerFn(listEmployees);
  const projectsFn = useServerFn(getMyProjects);
  const leavesFn = useServerFn(getAllLeaveRequests);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: () => employeesFn({}),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => projectsFn({}),
  });

  const { data: leavesData } = useQuery({
    queryKey: ["all-leaves-search"],
    queryFn: () => leavesFn({ data: {} }),
  });

  const leavesList = leavesData?.leaves ?? [];

  // Global Ctrl+K / Cmd+K or "/" shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA")
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onClose?.();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Format initials for avatar
  const getInitials = (name: string) => {
    return (
      name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "E"
    );
  };

  // Build searchable items list
  const allItems = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [...STATIC_SECTIONS, ...QUICK_ACTIONS];

    // Employees
    for (const emp of employees) {
      const isIt = emp.staff_section !== "BI Staff";
      items.push({
        id: `emp-${emp.id}`,
        title: emp.full_name,
        subtitle: `${emp.job_title || "Employee"} · ${emp.email ?? "No email"} · ${emp.department || "General"}`,
        category: "Employees",
        badge: emp.staff_section || (isIt ? "IT Team" : "BI Staff"),
        badgeColor: isIt
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
        to: `/admin/employee/${emp.id}`,
        avatarText: getInitials(emp.full_name),
        isClockedIn: emp.is_clocked_in,
      });
    }

    // Projects
    for (const p of projects) {
      items.push({
        id: `proj-${p.id}`,
        title: p.name,
        subtitle: `Status: ${p.status} · ${p.assigned_members_count ?? 0} members · ${p.description || "Project"}`,
        category: "Projects",
        badge: p.status,
        badgeColor: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
        to: "/project",
        icon: Briefcase,
      });
    }

    // Leaves
    for (const l of leavesList.slice(0, 30)) {
      items.push({
        id: `leave-${l.id}`,
        title: `${l.employee_name || "Employee"} — ${l.leave_type}`,
        subtitle: `${l.start_date} to ${l.end_date} · Status: ${l.status}${l.reason ? ` · "${l.reason}"` : ""}`,
        category: "Leave Requests",
        badge: l.status,
        badgeColor:
          l.status === "Approved"
            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : l.status === "Rejected"
              ? "bg-red-500/10 text-red-600 border-red-500/20"
              : "bg-amber-500/10 text-amber-600 border-amber-500/20",
        to: "/admin/leave",
        icon: CalendarDays,
      });
    }

    return items;
  }, [employees, projects, leavesList]);

  // Filter items based on query
  const filteredItems = useMemo<SearchItem[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Default suggestions when search bar is focused but empty
      return [
        ...STATIC_SECTIONS,
        ...QUICK_ACTIONS,
        ...allItems.filter((i) => i.category === "Employees").slice(0, 4),
      ];
    }

    return allItems
      .filter((item) => {
        return (
          item.title.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          (item.badge && item.badge.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
        );
      })
      .slice(0, 25);
  }, [query, allItems]);

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length, query]);

  // Handle item selection / redirect
  const handleSelect = (item: SearchItem) => {
    setIsOpen(false);
    setQuery("");
    onClose?.();

    if (item.actionId === "focus-create-form") {
      if (window.location.pathname === "/admin") {
        const formEl = document.getElementById("create-employee-fullName");
        if (formEl) {
          formEl.focus();
          formEl.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      navigate({ to: "/admin" });
      return;
    }

    navigate({ to: item.to });
  };

  // Keyboard navigation within suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      onClose?.();
    }
  };

  // Group filtered items by category
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    for (const item of filteredItems) {
      const existing = groups[item.category];
      if (existing) {
        existing.push(item);
      } else {
        groups[item.category] = [item];
      }
    }
    return groups;
  }, [filteredItems]);

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* SEARCH INPUT BOX */}
      <div
        className={`group flex h-9 items-center gap-2 rounded-lg border bg-card/95 px-3 shadow-xs backdrop-blur transition-all duration-200 ${
          isOpen
            ? "border-primary ring-2 ring-primary/20 shadow-md bg-card"
            : "border-border hover:border-border/80 hover:bg-card"
        }`}
      >
        <Search
          className={`size-3.5 shrink-0 transition-colors ${
            isOpen ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          }`}
        />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />

        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            title="Clear search"
            className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-3.5" />
          </button>
        )}

        <div className="hidden items-center gap-1 sm:flex">
          <kbd className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground shadow-2xs">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        </div>
      </div>

      {/* DROPDOWN SUGGESTIONS POPOVER */}
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-full min-w-[300px] sm:min-w-[440px] md:min-w-[480px] max-w-[calc(100vw-2rem)] max-h-[440px] overflow-y-auto rounded-xl border border-border bg-card p-2 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150">
          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-muted p-3 text-muted-foreground">
                <Search className="size-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">No matches found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                No sections, employees, leaves, or projects matched "{query}".
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Sparkles className="size-3 text-primary" />
                  {query ? `Search results for "${query}"` : "Quick Suggestions & Navigation"}
                </span>
                <span>{filteredItems.length} results</span>
              </div>

              <div className="space-y-3 pt-1">
                {Object.entries(groupedResults).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                      {category}
                    </div>

                    <div className="space-y-0.5">
                      {items.map((item) => {
                        const globalIndex = filteredItems.findIndex((x) => x.id === item.id);
                        const isSelected = globalIndex === selectedIndex;
                        const Icon = item.icon;

                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`group flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "text-foreground hover:bg-muted/60"
                            }`}
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              {/* AVATAR OR ICON */}
                              {item.avatarText ? (
                                <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                  {item.avatarText}
                                  {item.isClockedIn && (
                                    <span
                                      title="Currently Clocked In"
                                      className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-emerald-500"
                                    />
                                  )}
                                </div>
                              ) : Icon ? (
                                <div
                                  className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                                    isSelected
                                      ? "border-primary/30 bg-primary/20 text-primary"
                                      : "border-border bg-muted/50 text-muted-foreground group-hover:text-foreground"
                                  }`}
                                >
                                  <Icon className="size-4" />
                                </div>
                              ) : null}

                              {/* TEXT DETAILS */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-xs font-semibold leading-tight text-foreground group-hover:text-primary">
                                    {item.title}
                                  </p>
                                  {item.isClockedIn && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                                      <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                                      Live
                                    </span>
                                  )}
                                </div>
                                <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                                  {item.subtitle}
                                </p>
                              </div>
                            </div>

                            {/* RIGHT BADGE & ARROW */}
                            <div className="flex shrink-0 items-center gap-2">
                              {item.badge && (
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                                    item.badgeColor || "border-border bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {item.badge}
                                </span>
                              )}
                              <ArrowRight
                                className={`size-3.5 transition-transform ${
                                  isSelected
                                    ? "translate-x-0.5 text-primary opacity-100"
                                    : "text-muted-foreground opacity-0 group-hover:opacity-100"
                                }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* FOOTER SHORTCUTS */}
              <div className="mt-2 flex items-center justify-between border-t border-border/60 px-2.5 pt-2 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1">↑</kbd>
                    <kbd className="rounded border border-border bg-muted px-1">↓</kbd> to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border bg-muted px-1">↵</kbd> to select & redirect
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-border bg-muted px-1">Esc</kbd> to close
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Filter,
  FolderKanban,
  LayoutGrid,
  Mail,
  RefreshCw,
  Search,
  Shield,
  Table as TableIcon,
  Timer,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  getEmployeeAllData,
  getTeamHourlyReport,
  getTeamMembers,
  toggleEmployeeActiveStatus,
  type EmployeeAllData,
  type TeamHourlyReportRow,
  type TeamMember,
} from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & Hourly Reports — BI Tracker" },
      {
        name: "description",
        content:
          "Admin console for browsing team members, tracking live attendance status, reading hourly activity reports, and inspecting employee records.",
      },
      { property: "og:title", content: "Team & Hourly Reports — BI Tracker" },
    ],
  }),
  component: TeamPage,
});

function getInitials(name: string, email?: string | null) {
  const source = name || email || "U";
  return (
    source
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "U"
  );
}

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function TeamPage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const teamFn = useServerFn(getTeamMembers);
  const reportFn = useServerFn(getTeamHourlyReport);
  const activeToggleFn = useServerFn(toggleEmployeeActiveStatus);

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const {
    data: team,
    isLoading: teamLoading,
    refetch: refetchTeam,
  } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => teamFn({}),
  });

  // Top sub-tab: 'members' or 'report'
  const [activeMainTab, setActiveMainTab] = useState<"members" | "report">("members");

  // Filter state for Team Members
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // State for Hourly Report
  const [from, setFrom] = useState(isoDate(-6));
  const [to, setTo] = useState(isoDate());
  const [reportSearch, setReportSearch] = useState("");

  const {
    data: report,
    isLoading: reportLoading,
    refetch: refetchReport,
  } = useQuery({
    queryKey: ["team-report", from, to],
    queryFn: () => reportFn({ data: { from, to } }),
    enabled: activeMainTab === "report",
  });

  // Modal state for selected employee all-data
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const toggleActiveMutation = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeToggleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["team-report"] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
  });

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const m of team ?? []) {
      if (m.department) set.add(m.department);
    }
    return Array.from(set).sort();
  }, [team]);

  // Filtered members
  const filteredTeam = useMemo(() => {
    return (team ?? []).filter((m) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.jobTitle && m.jobTitle.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q));

      const matchesDept =
        departmentFilter === "all" ||
        (m.department && m.department.toLowerCase() === departmentFilter.toLowerCase());

      const matchesRole = roleFilter === "all" || m.role === roleFilter;

      let matchesStatus = true;
      if (statusFilter === "clocked_in") matchesStatus = m.isClockedIn;
      else if (statusFilter === "active") matchesStatus = m.isActive;
      else if (statusFilter === "inactive") matchesStatus = !m.isActive;

      return matchesSearch && matchesDept && matchesRole && matchesStatus;
    });
  }, [team, search, departmentFilter, roleFilter, statusFilter]);

  // Filtered report rows
  const filteredReport = useMemo(() => {
    return (report ?? []).filter((r) => {
      const q = reportSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.jobTitle && r.jobTitle.toLowerCase().includes(q)) ||
        (r.email && r.email.toLowerCase().includes(q))
      );
    });
  }, [report, reportSearch]);

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading team console…
      </div>
    );
  }

  // Strict Admin access check
  if (session.role !== "admin") {
    return (
      <AppShell session={session}>
        <Panel title="Restricted Access">
          <p className="text-sm text-muted-foreground">
            This area is restricted to administrators only.
          </p>
        </Panel>
      </AppShell>
    );
  }

  const totalMembers = team?.length ?? 0;
  const currentlyClockedIn = (team ?? []).filter((m) => m.isClockedIn).length;
  const totalWorkedToday = (team ?? []).reduce((acc, m) => acc + m.todayHoursWorked, 0);

  const reportTotalHours = (report ?? []).reduce((s, r) => s + r.hoursWorked, 0);
  const reportTotalCost = (report ?? []).reduce((s, r) => s + r.cost, 0);
  const reportTotalLogged = (report ?? []).reduce((s, r) => s + r.loggedHours, 0);

  return (
    <AppShell session={session}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Workforce directory, real-time shift attendance, hourly project activity reports, and comprehensive employee records.
          </p>
        </div>

        {/* Tab switch buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              refetchTeam();
              refetchReport();
            }}
            title="Refresh Data"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
          <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-xs">
            <button
              onClick={() => setActiveMainTab("members")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeMainTab === "members"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5" />
              Team Members ({totalMembers})
            </button>
            <button
              onClick={() => setActiveMainTab("report")}
              className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeMainTab === "report"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Activity className="size-3.5" />
              Hourly Report
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN TAB 1: TEAM MEMBERS                                                 */}
      {/* ========================================================================= */}
      {activeMainTab === "members" && (
        <div>
          {/* Summary KPI Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total members" value={totalMembers} />
            <div className="panel p-5">
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Clocked in now
              </p>
              <p className="stat-number mt-2 text-3xl font-semibold text-emerald-600 dark:text-emerald-400">
                {currentlyClockedIn}
                <span className="ml-1 text-base font-normal text-muted-foreground">/ {totalMembers}</span>
              </p>
            </div>
            <Stat label="Today's team hours" value={totalWorkedToday.toFixed(1)} suffix="h" />
            <Stat label="Departments" value={departments.length || 1} />
          </div>

          {/* Filter and Search Bar */}
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, job title or department…"
                className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-2 text-sm outline-none focus:border-primary"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Department Filter */}
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="all">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              {/* Role Filter */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="sub_admin">Sub Admin</option>
                <option value="admin">Admin</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="clocked_in">Clocked In Now</option>
                <option value="active">Active Accounts</option>
                <option value="inactive">Inactive</option>
              </select>

              {/* View Mode Toggle */}
              <div className="flex items-center rounded-md border border-border bg-secondary/50 p-1">
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "table" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded p-1.5 transition-colors ${
                    viewMode === "grid" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Team Content */}
          {teamLoading ? (
            <div className="grid min-h-60 place-items-center rounded-lg border border-border p-8 text-sm text-muted-foreground">
              Loading team directory…
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="grid min-h-60 place-items-center rounded-lg border border-dashed border-border p-8 text-center">
              <div>
                <Users className="mx-auto size-10 text-muted-foreground/50" />
                <p className="mt-2 text-base font-medium">No team members found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try adjusting your search query or filters.
                </p>
              </div>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-secondary/40 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3.5">Employee Name & Email</th>
                      <th className="px-4 py-3.5">Role</th>
                      <th className="px-4 py-3.5">Job Title & Dept</th>
                      <th className="px-4 py-3.5">Hourly Rate</th>
                      <th className="px-4 py-3.5">Live Shift</th>
                      <th className="px-4 py-3.5">Account Status</th>
                      <th className="px-4 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTeam.map((member) => (
                      <tr
                        key={member.id}
                        onClick={() => setSelectedEmployeeId(member.id)}
                        className="cursor-pointer transition-colors hover:bg-secondary/30"
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {getInitials(member.fullName, member.email)}
                              </span>
                              {member.isClockedIn && (
                                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground truncate">{member.fullName}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email || "No email"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <RoleBadge role={member.role} />
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-foreground">{member.jobTitle || "—"}</p>
                          <p className="text-xs text-muted-foreground">{member.department || "—"}</p>
                        </td>
                        <td className="stat-number px-4 py-3.5 font-semibold text-foreground">
                          ${member.hourlyRate.toFixed(2)}/hr
                        </td>
                        <td className="px-4 py-3.5">
                          {member.isClockedIn ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                              Clocked In
                              {member.currentShiftClockIn && (
                                <span className="text-[11px] opacity-80">
                                  ({new Date(member.currentShiftClockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                              Off Duty
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: member.id,
                                active: !member.isActive,
                              })
                            }
                            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                              member.isActive
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                                : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {member.isActive ? "Active" : "Disabled"}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployeeId(member.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                          >
                            View All Data <ExternalLink className="size-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeam.map((member) => (
                <EmployeeCard
                  key={member.id}
                  member={member}
                  onSelect={() => setSelectedEmployeeId(member.id)}
                  onToggleActive={(active) =>
                    toggleActiveMutation.mutate({ id: member.id, active })
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TAB 2: HOURLY REPORT                                                 */}
      {/* ========================================================================= */}
      {activeMainTab === "report" && (
        <div className="space-y-6">
          {/* Report KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Active contributors"
              value={(report ?? []).filter((r) => r.hoursWorked > 0 || r.loggedHours > 0).length}
            />
            <Stat label="Total hours in range" value={reportTotalHours.toFixed(2)} suffix="h" />
            <Stat label="Hourly tasks logged" value={reportTotalLogged} />
            <Stat label="Total Labour Cost" value={`$${reportTotalCost.toFixed(2)}`} />
          </div>

          <Panel
            title="Workforce Hourly Activity Report"
            hint="Review hours clocked, tasks logged, and daily project activities for every team member."
            action={
              <div className="flex flex-wrap items-end gap-2">
                <button
                  onClick={() => {
                    setFrom(isoDate(0));
                    setTo(isoDate(0));
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    setFrom(isoDate(-6));
                    setTo(isoDate(0));
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => {
                    setFrom(isoDate(-29));
                    setTo(isoDate(0));
                  }}
                  className="rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Last 30 Days
                </button>

                <div className="flex items-center gap-1.5 ml-1">
                  <label className="text-xs text-muted-foreground">
                    From
                    <input
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                      className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </label>
                  <label className="text-xs text-muted-foreground">
                    To
                    <input
                      type="date"
                      value={to}
                      onChange={(e) => setTo(e.target.value)}
                      className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary"
                    />
                  </label>
                </div>
              </div>
            }
          >
            {/* Filter within report */}
            <div className="mb-4">
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Filter report by person, department, or job title…"
                className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>

            {reportLoading ? (
              <div className="grid min-h-48 place-items-center text-xs text-muted-foreground">
                Calculating team hourly report…
              </div>
            ) : filteredReport.length === 0 ? (
              <div className="grid min-h-48 place-items-center text-center text-xs text-muted-foreground">
                No activity data found for this date range.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReport.map((r) => (
                  <details
                    key={r.userId}
                    className="group rounded-lg border border-border bg-card transition-all"
                  >
                    <summary className="flex cursor-pointer select-none flex-wrap items-center gap-3 p-4 text-sm font-medium transition-colors hover:bg-secondary/30">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {getInitials(r.name, r.email)}
                        </span>
                        <div>
                          <p className="font-semibold text-foreground">{r.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.department || "No department"}
                            {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="ml-auto flex items-center gap-4 text-xs">
                        <span className="stat-number rounded-md bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                          {r.hoursWorked.toFixed(2)}h clocked
                        </span>
                        <span className="stat-number text-muted-foreground">
                          {r.loggedHours} tasks logged
                        </span>
                        <span className="stat-number font-semibold text-foreground">
                          ${r.cost.toFixed(2)}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedEmployeeId(r.userId);
                          }}
                          className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-secondary hover:text-primary"
                        >
                          View All Data
                        </button>
                        <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </div>
                    </summary>

                    <div className="border-t border-border/80 bg-secondary/15 p-4 space-y-4">
                      {/* Shifts within range */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Shift Records in Range ({r.shifts.length})
                        </h4>
                        {r.shifts.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No shift clock-ins during this period.</p>
                        ) : (
                          <ul className="divide-y divide-border rounded-md border border-border bg-card">
                            {r.shifts.map((s, i) => (
                              <li
                                key={`${r.userId}-shift-${i}`}
                                className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs"
                              >
                                <span className="stat-number font-medium text-foreground w-24">
                                  {s.date}
                                </span>
                                <span className="text-muted-foreground">
                                  In {new Date(s.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Out{" "}
                                  {s.clockOut
                                    ? new Date(s.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                                    : "in progress"}
                                </span>
                                <span className="stat-number ml-auto font-semibold text-primary">
                                  {s.clockOut ? `${s.hours.toFixed(2)} h` : "in progress"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Hourly Logs within range */}
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Hourly Work Logs in Range ({r.logs.length})
                        </h4>
                        {r.logs.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No hourly activity entries recorded in this period.</p>
                        ) : (
                          <ul className="divide-y divide-border rounded-md border border-border bg-card">
                            {r.logs.map((l, i) => (
                              <li
                                key={`${r.userId}-log-${i}`}
                                className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs"
                              >
                                <span className="stat-number w-20 shrink-0 font-medium text-muted-foreground">
                                  {l.log_date}
                                </span>
                                <span className="stat-number w-24 shrink-0 font-semibold text-primary">
                                  {(l.start_time ?? `${String(l.hour_slot).padStart(2, "0")}:00`).slice(0, 5)}
                                  {" – "}
                                  {(l.end_time ?? `${String((l.hour_slot + 1) % 24).padStart(2, "0")}:00`).slice(0, 5)}
                                </span>
                                <span className="min-w-40 flex-1 text-foreground">
                                  {l.project ? (
                                    <strong className="mr-1.5 text-primary">[{l.project}]</strong>
                                  ) : null}
                                  {l.task}
                                </span>
                                <span className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                                  {l.status || l.category}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Selected Employee All-Data Modal */}
      {selectedEmployeeId && (
        <EmployeeAllDataModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </AppShell>
  );
}

function RoleBadge({ role }: { role: "admin" | "sub_admin" | "employee" }) {
  if (role === "admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        <Shield className="size-3" /> Admin
      </span>
    );
  }
  if (role === "sub_admin") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
        <Shield className="size-3" /> Sub Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-xs text-muted-foreground">
      Employee
    </span>
  );
}

function EmployeeCard({
  member,
  onSelect,
  onToggleActive,
}: {
  member: TeamMember;
  onSelect: () => void;
  onToggleActive: (active: boolean) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="group relative flex cursor-pointer flex-col justify-between rounded-lg border border-border bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div>
        {/* Header: Avatar, Name, Role & Status Indicator */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {getInitials(member.fullName, member.email)}
              </span>
              {member.isClockedIn && (
                <span className="absolute bottom-0 right-0 size-3 rounded-full border-2 border-background bg-emerald-500" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground group-hover:text-primary transition-colors">
                {member.fullName}
              </h3>
              <p className="truncate text-xs text-muted-foreground">
                {member.jobTitle || "Team Member"}
              </p>
            </div>
          </div>
          <RoleBadge role={member.role} />
        </div>

        {/* Info Tags */}
        <div className="mt-4 space-y-2 text-xs text-muted-foreground">
          {member.department && (
            <div className="flex items-center gap-2">
              <Building2 className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{member.department}</span>
            </div>
          )}
          {member.email && (
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{member.email}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <DollarSign className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="stat-number font-semibold text-foreground">${member.hourlyRate.toFixed(2)}/hr</span>
          </div>
        </div>

        {/* Live Attendance Status Banner */}
        <div className="mt-4">
          {member.isClockedIn ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                Clocked in{" "}
                {member.currentShiftClockIn
                  ? `since ${new Date(member.currentShiftClockIn).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "now"}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              <span>Off Duty · {member.isActive ? "Active Account" : "Disabled"}</span>
            </div>
          )}
        </div>
      </div>

      {/* Card Footer */}
      <div className="mt-5 border-t border-border/60 pt-3">
        <div className="flex items-center justify-between text-xs">
          <div>
            <span className="text-muted-foreground">Today: </span>
            <span className="stat-number font-semibold text-foreground">
              {member.todayHoursWorked.toFixed(1)}h
            </span>
          </div>
          <span className="inline-flex items-center gap-1 font-medium text-primary group-hover:underline">
            All data <ExternalLink className="size-3" />
          </span>
        </div>
      </div>
    </div>
  );
}

function EmployeeAllDataModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const getEmployeeFn = useServerFn(getEmployeeAllData);
  const { data, isLoading, error } = useQuery({
    queryKey: ["employee-all-data", employeeId],
    queryFn: () => getEmployeeFn({ data: { employeeId } }),
  });

  const [activeTab, setActiveTab] = useState<"logs" | "shifts" | "leaves" | "profile">("logs");
  const [logSearch, setLogSearch] = useState("");
  const [logDateFilter, setLogDateFilter] = useState("");

  const filteredLogs = useMemo(() => {
    return (data?.hourlyLogs ?? []).filter((l) => {
      const matchesDate = !logDateFilter || l.logDate === logDateFilter;
      const q = logSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        l.task.toLowerCase().includes(q) ||
        l.project.toLowerCase().includes(q) ||
        l.category.toLowerCase().includes(q) ||
        l.status.toLowerCase().includes(q);
      return matchesDate && matchesSearch;
    });
  }, [data?.hourlyLogs, logDateFilter, logSearch]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal Card */}
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-card px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {data?.profile ? getInitials(data.profile.fullName, data.profile.email) : "U"}
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                {data?.profile ? data.profile.fullName : "Loading employee details…"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {data?.profile.jobTitle ?? "Employee"}
                {data?.profile.department ? ` · ${data.profile.department}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md border border-border p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="grid min-h-80 place-items-center p-8 text-sm text-muted-foreground">
            Loading full employee records…
          </div>
        ) : error || !data ? (
          <div className="grid min-h-80 place-items-center p-8 text-center text-sm text-destructive">
            Could not load employee details.
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-y-auto">
            {/* Top Employee Overview Bar */}
            <div className="border-b border-border bg-secondary/20 px-5 py-4 sm:px-6">
              {/* Live shift indicator if clocked in */}
              {data.stats.isCurrentlyClockedIn && (
                <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span>Currently Clocked In & Working</span>
                  </div>
                  {data.stats.currentShiftStartedAt && (
                    <span className="stat-number font-medium">
                      Started at {new Date(data.stats.currentShiftStartedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </div>
              )}

              {/* Stat KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Total Shift Hours
                  </p>
                  <p className="stat-number mt-1 text-xl font-bold text-foreground">
                    {data.stats.totalClockedHours.toFixed(1)}
                    <span className="ml-0.5 text-xs text-muted-foreground font-normal">h</span>
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Completed Shifts
                  </p>
                  <p className="stat-number mt-1 text-xl font-bold text-foreground">
                    {data.stats.totalShifts}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Hourly Tasks Logged
                  </p>
                  <p className="stat-number mt-1 text-xl font-bold text-foreground">
                    {data.stats.totalLoggedTasks}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Leave Days Taken
                  </p>
                  <p className="stat-number mt-1 text-xl font-bold text-foreground">
                    {data.stats.totalLeaveDays}
                    <span className="ml-0.5 text-xs text-muted-foreground font-normal">days</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation Tabs inside modal */}
            <div className="flex border-b border-border bg-card px-5 sm:px-6">
              <button
                onClick={() => setActiveTab("logs")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "logs"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="size-4" />
                Hourly Activity Logs ({data.hourlyLogs.length})
              </button>
              <button
                onClick={() => setActiveTab("shifts")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "shifts"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Clock className="size-4" />
                Shift History ({data.shifts.length})
              </button>
              <button
                onClick={() => setActiveTab("leaves")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "leaves"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <CalendarDays className="size-4" />
                Leaves ({data.leaves.length})
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === "profile"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserRound className="size-4" />
                Profile & Details
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-5 sm:p-6">
              {/* TAB 1: HOURLY ACTIVITY LOGS */}
              {activeTab === "logs" && (
                <div className="space-y-5">
                  {/* Project Distribution Breakdown Bar */}
                  {data.projectBreakdown.length > 0 && (
                    <div className="rounded-lg border border-border bg-card p-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Project Workload Breakdown
                      </h4>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {data.projectBreakdown.map((p) => (
                          <div
                            key={p.project}
                            className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-xs"
                          >
                            <FolderKanban className="size-3.5 text-primary" />
                            <span className="font-medium text-foreground">{p.project}</span>
                            <span className="stat-number font-semibold text-primary">{p.hours}h</span>
                            <span className="text-muted-foreground">({p.taskCount} tasks)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search and Date filter for logs */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative min-w-56 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={logSearch}
                        onChange={(e) => setLogSearch(e.target.value)}
                        placeholder="Search tasks, projects, categories…"
                        className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary"
                      />
                    </div>
                    <input
                      type="date"
                      value={logDateFilter}
                      onChange={(e) => setLogDateFilter(e.target.value)}
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                    />
                    {logDateFilter && (
                      <button
                        onClick={() => setLogDateFilter("")}
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Clear date
                      </button>
                    )}
                  </div>

                  {/* Logs Table */}
                  {filteredLogs.length === 0 ? (
                    <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No hourly logs match the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-secondary/40 uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2.5">Date</th>
                              <th className="px-3 py-2.5">Time Range</th>
                              <th className="px-3 py-2.5">Project / Task</th>
                              <th className="px-3 py-2.5">Category</th>
                              <th className="px-3 py-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {filteredLogs.map((l) => (
                              <tr key={l.id} className="hover:bg-secondary/20">
                                <td className="stat-number whitespace-nowrap px-3 py-2.5 font-medium text-foreground">
                                  {l.logDate}
                                </td>
                                <td className="stat-number whitespace-nowrap px-3 py-2.5 text-primary font-medium">
                                  {l.startTime && l.endTime
                                    ? `${l.startTime.slice(0, 5)} – ${l.endTime.slice(0, 5)}`
                                    : `${String(l.hourSlot).padStart(2, "0")}:00 – ${String(
                                        (l.hourSlot + 1) % 24,
                                      ).padStart(2, "0")}:00`}
                                </td>
                                <td className="px-3 py-2.5">
                                  <div className="flex flex-col">
                                    {l.project ? (
                                      <span className="font-semibold text-foreground">
                                        [{l.project}]
                                      </span>
                                    ) : null}
                                    <span className="text-foreground/90">{l.task}</span>
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <span className="rounded bg-secondary px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                                    {l.category}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2.5">
                                  <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium">
                                    {l.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SHIFT RECORDS */}
              {activeTab === "shifts" && (
                <div className="space-y-4">
                  {data.shifts.length === 0 ? (
                    <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No shift records found for this employee.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-secondary/40 uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">Date</th>
                              <th className="px-4 py-3">Clock In</th>
                              <th className="px-4 py-3">Clock Out</th>
                              <th className="px-4 py-3">Duration</th>
                              <th className="px-4 py-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {data.shifts.map((s) => (
                              <tr key={s.id} className="hover:bg-secondary/20">
                                <td className="stat-number px-4 py-3 font-medium text-foreground">
                                  {String(s.clockIn).slice(0, 10)}
                                </td>
                                <td className="stat-number px-4 py-3 text-muted-foreground">
                                  {new Date(s.clockIn).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="stat-number px-4 py-3 text-muted-foreground">
                                  {s.clockOut ? (
                                    new Date(s.clockOut).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  ) : (
                                    <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                      <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      In progress
                                    </span>
                                  )}
                                </td>
                                <td className="stat-number px-4 py-3 font-semibold text-primary">
                                  {s.hours.toFixed(2)}h
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {s.note || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: LEAVE REQUESTS */}
              {activeTab === "leaves" && (
                <div className="space-y-4">
                  {data.leaves.length === 0 ? (
                    <div className="grid min-h-36 place-items-center rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      No leave requests filed by this employee.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-border bg-card">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="border-b border-border bg-secondary/40 uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3">Leave Type</th>
                              <th className="px-4 py-3">Dates</th>
                              <th className="px-4 py-3">Duration</th>
                              <th className="px-4 py-3">Reason</th>
                              <th className="px-4 py-3">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {data.leaves.map((lv) => (
                              <tr key={lv.id} className="hover:bg-secondary/20">
                                <td className="px-4 py-3 font-medium text-foreground">
                                  {lv.leaveType}
                                </td>
                                <td className="stat-number px-4 py-3 text-muted-foreground">
                                  {lv.startDate} to {lv.endDate}
                                </td>
                                <td className="stat-number px-4 py-3 font-semibold text-foreground">
                                  {lv.daysCount} {lv.daysCount === 1 ? "day" : "days"}
                                </td>
                                <td className="px-4 py-3 text-muted-foreground">
                                  {lv.reason || "—"}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                      lv.status?.toLowerCase() === "approved"
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        : lv.status?.toLowerCase() === "rejected"
                                          ? "bg-destructive/10 text-destructive"
                                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {lv.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: PROFILE & DETAILS */}
              {activeTab === "profile" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Personal & Work Identity
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="block text-xs text-muted-foreground">Full Name</span>
                        <span className="font-medium text-foreground">{data.profile.fullName}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Email Address</span>
                        <span className="font-medium text-foreground">{data.profile.email || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Job Title</span>
                        <span className="font-medium text-foreground">{data.profile.jobTitle || "—"}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Department / Team</span>
                        <span className="font-medium text-foreground">{data.profile.department || "—"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Access & Account Settings
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="block text-xs text-muted-foreground">Role</span>
                        <div className="mt-0.5">
                          <RoleBadge role={data.profile.role} />
                        </div>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Account Status</span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            data.profile.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                          }`}
                        >
                          <UserCheck className="size-3.5" />
                          {data.profile.isActive ? "Active Account" : "Suspended / Inactive"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Hourly Rate</span>
                        <span className="stat-number font-semibold text-foreground">
                          ${data.profile.hourlyRate.toFixed(2)}/hr
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Member Since</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(data.profile.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground">Employee ID</span>
                        <span className="stat-number text-xs text-muted-foreground break-all">
                          {data.profile.id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-border bg-card px-5 py-3 sm:px-6">
          <button
            onClick={onClose}
            className="rounded-md bg-secondary px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

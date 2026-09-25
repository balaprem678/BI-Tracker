import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
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
  MapPin,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  Shield,
  Table as TableIcon,
  Timer,
  UserCheck,
  UserCog,
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

export const Route = createFileRoute("/_authenticated/bi-staff")({
  head: () => ({
    meta: [
      { title: "BI Staff & Hourly Reports — BI Tracker" },
      {
        name: "description",
        content:
          "Admin console for browsing BI Staff members, tracking live attendance status, reading hourly activity reports, and inspecting employee records.",
      },
      { property: "og:title", content: "BI Staff & Hourly Reports — BI Tracker" },
    ],
  }),
  component: BiStaffPage,
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

function BiStaffPage() {
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

  // BI Staff members filter
  const biStaffMembers = useMemo(() => {
    return (team ?? []).filter((m) => m.staffSection === "BI Staff");
  }, [team]);

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const m of biStaffMembers) {
      if (m.department) set.add(m.department);
    }
    return Array.from(set).sort();
  }, [biStaffMembers]);

  // Filtered members
  const filteredTeam = useMemo(() => {
    return biStaffMembers.filter((m) => {
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
  }, [biStaffMembers, search, departmentFilter, roleFilter, statusFilter]);

  // Filtered report rows
  const filteredReport = useMemo(() => {
    return (report ?? [])
      .filter((r) => r.staffSection === "BI Staff")
      .filter((r) => {
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
        Loading BI staff console…
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

  const totalMembers = biStaffMembers.length;
  const currentlyClockedIn = biStaffMembers.filter((m) => m.isClockedIn).length;
  const totalWorkedToday = biStaffMembers.reduce((acc, m) => acc + m.todayHoursWorked, 0);

  const reportTotalHours = filteredReport.reduce((s, r) => s + r.hoursWorked, 0);
  const reportTotalCost = filteredReport.reduce((s, r) => s + r.cost, 0);
  const reportTotalLogged = filteredReport.reduce((s, r) => s + r.loggedHours, 0);

  return (
    <AppShell session={session}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">BI Staff</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            BI Staff workforce directory, real-time shift attendance, hourly project activity reports, and comprehensive employee records.
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
              <UserRound className="size-3.5" />
              BI Staff Members ({totalMembers})
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
      {/* MAIN TAB 1: BI STAFF MEMBERS                                              */}
      {/* ========================================================================= */}
      {activeMainTab === "members" && (
        <div>
          {/* Summary KPI Stats */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Total staff" value={totalMembers} />
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
            <Stat label="Today's staff hours" value={totalWorkedToday.toFixed(1)} suffix="h" />
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="all">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="all">All Roles</option>
                <option value="employee">Employee</option>
                <option value="sub_admin">Sub-Admin</option>
                <option value="admin">Admin</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="all">All Statuses</option>
                <option value="clocked_in">Clocked In Now</option>
                <option value="active">Active Account</option>
                <option value="inactive">Inactive Account</option>
              </select>

              <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                <button
                  onClick={() => setViewMode("table")}
                  className={`rounded p-1.5 text-xs ${
                    viewMode === "table"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Table View"
                >
                  <TableIcon className="size-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`rounded p-1.5 text-xs ${
                    viewMode === "grid"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid className="size-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Member Content */}
          {teamLoading ? (
            <div className="grid h-64 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
              Loading BI staff members…
            </div>
          ) : filteredTeam.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-lg border border-border bg-card p-6 text-center">
              <div>
                <UserRound className="mx-auto size-10 text-muted-foreground/50" />
                <p className="mt-2 text-base font-semibold">No BI staff members found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting search query or filters, or add employees into the BI Staff section from the Admin Panel.
                </p>
              </div>
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Attendance</th>
                    <th className="px-4 py-3">Today's Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTeam.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            {m.photoUrl ? (
                              <img
                                src={m.photoUrl}
                                alt={m.fullName}
                                className="size-9 rounded-full object-cover border border-primary/20 shadow-xs"
                              />
                            ) : (
                              <div className="grid size-9 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {getInitials(m.fullName, m.email)}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{m.fullName}</p>
                            <p className="text-xs text-muted-foreground">{m.email || "No email"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            m.role === "admin"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                              : m.role === "sub_admin"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-secondary text-secondary-foreground"
                          }`}
                        >
                          {m.role === "admin" && <Shield className="size-3" />}
                          {m.role === "sub_admin" && <Shield className="size-3" />}
                          {m.role === "admin" ? "Admin" : m.role === "sub_admin" ? "Sub-Admin" : "Employee"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {m.department || "General"}
                      </td>
                      <td className="px-4 py-3">
                        {m.isClockedIn ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="relative flex size-1.5">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
                            </span>
                            Clocked In
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                            Clocked Out
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold">
                        {m.todayHoursWorked > 0 ? (
                          <span className="text-foreground">{m.todayHoursWorked.toFixed(2)}h</span>
                        ) : (
                          <span className="text-muted-foreground">0.00h</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActiveMutation.mutate({ id: m.id, active: !m.isActive })}
                          disabled={toggleActiveMutation.isPending || m.id === session.userId}
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                            m.isActive
                              ? "text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${m.isActive ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                          {m.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to="/admin/employee/$id"
                            params={{ id: m.id }}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-secondary hover:text-primary hover:border-primary/40"
                            title="Edit employee account details"
                          >
                            <UserCog className="size-3" /> Edit Account
                          </Link>
                          <button
                            onClick={() => setSelectedEmployeeId(m.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
                          >
                            View Full Details
                            <ChevronRight className="size-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeam.map((m) => (
                <div key={m.id} className="panel p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {m.photoUrl ? (
                            <img
                              src={m.photoUrl}
                              alt={m.fullName}
                              className="size-10 rounded-full object-cover border border-primary/20 shadow-xs"
                            />
                          ) : (
                            <div className="grid size-10 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                              {getInitials(m.fullName, m.email)}
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground">{m.fullName}</h3>
                          <p className="text-xs text-muted-foreground">{m.jobTitle || "Employee"}</p>
                        </div>
                      </div>
                      {m.isClockedIn ? (
                        <span className="inline-flex size-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" title="Clocked In Now" />
                      ) : (
                        <span className="inline-flex size-2.5 rounded-full bg-muted-foreground/30" title="Clocked Out" />
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Department</p>
                        <p className="font-medium">{m.department || "General"}</p>
                      </div>
                      <div className="rounded-md bg-muted/40 p-2">
                        <p className="text-muted-foreground">Today's Hours</p>
                        <p className="font-mono font-medium">{m.todayHoursWorked.toFixed(2)}h</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs">
                    <Link
                      to="/admin/employee/$id"
                      params={{ id: m.id }}
                      className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-primary hover:underline"
                      title="Edit employee account details"
                    >
                      <UserCog className="size-3" /> Edit Account
                    </Link>
                    <button
                      onClick={() => setSelectedEmployeeId(m.id)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      View Details
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MAIN TAB 2: HOURLY REPORT                                                 */}
      {/* ========================================================================= */}
      {activeMainTab === "report" && (
        <div>
          {/* Date range picker & Search */}
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-medium">
                <CalendarDays className="size-4 text-muted-foreground" />
                <span>From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span>To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Search report by name or department…"
                className="w-full rounded-md border border-input bg-background pl-9 pr-4 py-1.5 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Report KPI Stats */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Total Worked Hours" value={reportTotalHours.toFixed(2)} suffix="h" />
            <Stat label="Total Hourly Logs" value={reportTotalLogged} />
            <Stat label="Total Labor Cost" value={`$${reportTotalCost.toFixed(2)}`} />
          </div>

          {/* Report Table */}
          {reportLoading ? (
            <div className="grid h-64 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
              Generating BI Staff hourly activity report…
            </div>
          ) : filteredReport.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-lg border border-border bg-card p-6 text-center">
              <div>
                <Activity className="mx-auto size-10 text-muted-foreground/50" />
                <p className="mt-2 text-base font-semibold">No hourly report records found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting the date range or search filter.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Worked Hours</th>
                    <th className="px-4 py-3">Tasks Logged</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredReport.map((r) => (
                    <tr key={r.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {getInitials(r.name, r.email)}
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{r.name}</p>
                            <p className="text-xs text-muted-foreground">{r.jobTitle || "Employee"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.department || "General"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                        {r.hoursWorked.toFixed(2)}h
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {r.loggedHours} logs
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setSelectedEmployeeId(r.userId)}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground hover:bg-secondary"
                        >
                          View Details
                          <ChevronRight className="size-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMPLOYEE FULL DETAILS                                              */}
      {/* ========================================================================= */}
      {selectedEmployeeId && (
        <EmployeeDetailsModal
          employeeId={selectedEmployeeId}
          onClose={() => setSelectedEmployeeId(null)}
        />
      )}
    </AppShell>
  );
}

function EmployeeDetailsModal({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const getEmployeeAllDataFn = useServerFn(getEmployeeAllData);
  const { data: fullData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["employee-all-data", employeeId],
    queryFn: () => getEmployeeAllDataFn({ data: { employeeId } }),
  });

  const [isFullscreen, setIsFullscreen] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "shifts" | "logs" | "leaves">("overview");

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl text-center space-y-3">
          <RefreshCw className="mx-auto size-8 animate-spin text-primary" />
          <h3 className="text-base font-semibold text-foreground">Loading employee record…</h3>
          <p className="text-xs text-muted-foreground">Fetching complete attendance, shifts, hourly logs and leaves.</p>
        </div>
      </div>
    );
  }

  if (isError || !fullData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl text-center space-y-4">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Failed to load employee record</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : "An unexpected error occurred while fetching details."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => refetch()}
              className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="rounded-md border border-border bg-secondary px-4 py-2 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, stats, projectBreakdown, shifts, hourlyLogs, leaves } = fullData;

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-50 flex flex-col bg-background w-screen h-screen overflow-hidden"
          : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-6 overflow-hidden"
      }
    >
      {!isFullscreen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={
          isFullscreen
            ? "relative flex flex-col w-full h-full bg-background overflow-hidden"
            : "relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden my-auto"
        }
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border bg-card/95 px-6 py-4 shrink-0 backdrop-blur-xs">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              {profile.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  className="size-12 rounded-full object-cover border border-primary/20 shadow-xs"
                />
              ) : (
                <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  {getInitials(profile.fullName, profile.email)}
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{profile.fullName}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    profile.role === "admin"
                      ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                      : profile.role === "sub_admin"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {profile.role}
                </span>
                {stats.isCurrentlyClockedIn && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    Active Shift Now
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {profile.jobTitle || "Employee"} • {profile.department || "General Department"} • BI Staff
                {profile.employeeId ? ` • ID: ${profile.employeeId}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/admin/employee/$id"
              params={{ id: employeeId }}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-3.5 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <UserCog className="size-3.5" />
              Edit Account
            </Link>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Modal Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-6 pt-2 gap-2 text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "overview"
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview &amp; Stats
          </button>
          <button
            onClick={() => setActiveTab("shifts")}
            className={`border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "shifts"
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Shift History ({shifts.length})
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "logs"
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Hourly Task Logs ({hourlyLogs.length})
          </button>
          <button
            onClick={() => setActiveTab("leaves")}
            className={`border-b-2 px-3 py-2.5 transition-colors ${
              activeTab === "leaves"
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Leave Requests ({leaves.length})
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-6xl mx-auto w-full space-y-6">
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* 4 Stats Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-xs font-medium">Clocked Hours</span>
                      <Clock className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">{stats.totalClockedHours.toFixed(1)}h</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Across all recorded shifts</p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-xs font-medium">Total Shifts</span>
                      <Timer className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">{stats.totalShifts}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {stats.isCurrentlyClockedIn ? "1 shift in progress" : "All shifts completed"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-xs font-medium">Logged Tasks</span>
                      <FolderKanban className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">{stats.totalLoggedTasks}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Hourly reports registered</p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between text-muted-foreground mb-1">
                      <span className="text-xs font-medium">Leave Days</span>
                      <CalendarDays className="size-4 text-primary" />
                    </div>
                    <p className="text-2xl font-bold font-mono text-foreground">{stats.totalLeaveDays}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Approved or pending days</p>
                  </div>
                </div>

                {/* 2-Column Split: Project breakdown & Profile details */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Project breakdown */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center justify-between">
                      <span>Project Time Distribution</span>
                      <span className="font-mono text-[11px] text-foreground font-normal">
                        {projectBreakdown.length} projects
                      </span>
                    </h4>
                    {projectBreakdown.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-8 text-center">No hourly project tasks logged yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {projectBreakdown.map((pb) => (
                          <div key={pb.project} className="rounded-lg border border-border bg-muted/20 p-3.5 text-xs">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-semibold text-foreground text-sm">{pb.project}</span>
                              <span className="font-mono font-bold text-primary text-sm">{pb.hours}h</span>
                            </div>
                            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                              <span>{pb.taskCount} task slots recorded</span>
                              <span>{Math.round((pb.hours / (stats.totalLoggedTasks || 1)) * 100)}% of logged tasks</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Profile info card */}
                  <div className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Staff Member Particulars
                    </h4>
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-2 border-b border-border/60">
                        <span className="text-muted-foreground">Email Address</span>
                        <span className="font-medium text-foreground">{profile.email || "No email"}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border/60">
                        <span className="text-muted-foreground">Staff Section</span>
                        <span className="font-medium text-foreground">{profile.staffSection || "BI Staff"}</span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border/60">
                        <span className="text-muted-foreground">Account Status</span>
                        <span className={`font-semibold ${profile.isActive ? "text-emerald-500" : "text-amber-500"}`}>
                          {profile.isActive ? "Active Account" : "Inactive / Suspended"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2 border-b border-border/60">
                        <span className="text-muted-foreground">Current Live State</span>
                        <span className={`font-semibold ${stats.isCurrentlyClockedIn ? "text-emerald-500" : "text-muted-foreground"}`}>
                          {stats.isCurrentlyClockedIn ? "Clocked In Now" : "Clocked Out"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-2">
                        <span className="text-muted-foreground">Member Since</span>
                        <span className="font-medium text-foreground">
                          {new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "shifts" && (
              <div className="space-y-3">
                {shifts.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <Timer className="mx-auto size-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-semibold text-foreground">No shift records found</p>
                    <p className="text-xs text-muted-foreground mt-1">This staff member has not recorded any work shifts yet.</p>
                  </div>
                ) : (
                  shifts.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-xl border border-border bg-card p-4 text-xs transition-colors hover:border-primary/40 shadow-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground text-sm">
                            {new Date(s.clockIn).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          {s.clockOut ? (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                              Completed Shift
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Now
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <p className="text-muted-foreground font-mono">
                            {new Date(s.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {s.clockOut
                              ? new Date(s.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                              : "Active Now"}
                          </p>
                          <span className="rounded-md bg-primary/10 border border-primary/20 px-2.5 py-1 font-mono font-bold text-primary text-xs">
                            {s.hours.toFixed(2)}h
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                        <div className="flex items-start gap-2 bg-muted/20 rounded-lg p-2.5 border border-border/50">
                          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 shrink-0">
                            Clock In Location
                          </span>
                          <span className="text-foreground">
                            {s.clockInLocationName ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3 text-emerald-500 shrink-0" />
                                {s.clockInLocationName}
                              </span>
                            ) : (
                              <span className="italic text-muted-foreground/70">Not recorded</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-start gap-2 bg-muted/20 rounded-lg p-2.5 border border-border/50">
                          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 shrink-0">
                            Clock Out Location
                          </span>
                          <span className="text-foreground">
                            {s.clockOutLocationName ? (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3 text-amber-500 shrink-0" />
                                {s.clockOutLocationName}
                              </span>
                            ) : s.clockOut ? (
                              <span className="italic text-muted-foreground/70">Not recorded</span>
                            ) : (
                              <span className="text-emerald-500 font-medium italic">Shift currently in progress</span>
                            )}
                          </span>
                        </div>
                      </div>

                      {s.note && (
                        <p className="mt-2.5 text-muted-foreground italic bg-muted/10 p-2 rounded border border-border/30 text-[11px]">
                          Note: "{s.note}"
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "logs" && (
              <div className="space-y-3">
                {hourlyLogs.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <FolderKanban className="mx-auto size-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-semibold text-foreground">No hourly task logs found</p>
                    <p className="text-xs text-muted-foreground mt-1">No hourly task updates have been submitted by this employee.</p>
                  </div>
                ) : (
                  hourlyLogs.map((l) => (
                    <div key={l.id} className="rounded-xl border border-border bg-card p-4 text-xs space-y-2 shadow-xs">
                      <div className="flex items-center justify-between font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm">{l.project || "General"}</span>
                          <span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground font-mono">
                            {l.category}
                          </span>
                        </div>
                        <span className="text-muted-foreground font-mono text-[11px]">{l.logDate} • Slot {l.hourSlot}</span>
                      </div>
                      <p className="text-foreground/90 text-xs leading-relaxed">{l.task}</p>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "leaves" && (
              <div className="space-y-3">
                {leaves.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-12 text-center">
                    <CalendarDays className="mx-auto size-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-semibold text-foreground">No leave requests found</p>
                    <p className="text-xs text-muted-foreground mt-1">No leave applications found on file.</p>
                  </div>
                ) : (
                  leaves.map((lv) => (
                    <div key={lv.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-xs shadow-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground text-sm">{lv.leaveType}</p>
                          <span className="rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary">
                            {lv.daysCount} {lv.daysCount === 1 ? "day" : "days"}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5">{lv.startDate} to {lv.endDate}</p>
                        {lv.reason && <p className="mt-1 text-muted-foreground italic">"{lv.reason}"</p>}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          lv.status?.toLowerCase() === "approved"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : lv.status?.toLowerCase() === "rejected"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {lv.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-muted/30 px-6 py-3.5 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted-foreground font-mono">
            {profile.fullName} • Record ID: {employeeId.slice(0, 8)}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {isFullscreen ? "Windowed View" : "Fullscreen"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-border bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

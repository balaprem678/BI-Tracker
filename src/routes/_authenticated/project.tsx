import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  FolderKanban,
  Clock,
  Users,
  Calendar,
  Filter,
  BarChart3,
  CheckCircle2,
  Layers,
  Sparkles,
  Search,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  getMyProjects,
  getProjectHourlyReport,
  getProjectsManagementList,
  Project,
  ProjectSession,
} from "@/lib/project.functions";

export const Route = createFileRoute("/_authenticated/project")({
  head: () => ({
    meta: [
      { title: "Project Management & Hours — BI Tracker" },
      {
        name: "description",
        content:
          "Project-wise hour management, real-time sessions, and employee tracking analytics.",
      },
      { property: "og:title", content: "Project Management & Hours — BI Tracker" },
      {
        property: "og:description",
        content: "Track and manage project-wise hours and sessions across teams.",
      },
    ],
  }),
  component: ProjectPage,
});

function todayIso(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function formatSeconds(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(
    secs,
  ).padStart(2, "0")}`;
}

function timeOnly(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ProjectPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const projectsMgmtFn = useServerFn(getProjectsManagementList);
  const myProjectsFn = useServerFn(getMyProjects);
  const projectReportFn = useServerFn(getProjectHourlyReport);

  const today = todayIso(0);
  const weekAgo = todayIso(-7);

  const [activeTab, setActiveTab] = useState<"overview" | "reports">("overview");
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedStaffSection, setSelectedStaffSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => sessionFn({}),
  });

  const isPrivileged = session?.role === "admin" || session?.role === "sub_admin";

  const { data: projectsList = [] } = useQuery({
    queryKey: ["projects-list", session?.role],
    queryFn: () => (isPrivileged ? projectsMgmtFn({}) : myProjectsFn({})),
    enabled: !!session,
  });

  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: [
      "project-hourly-report",
      startDate,
      endDate,
      selectedProjectId,
      selectedStaffSection,
    ],
    queryFn: () =>
      projectReportFn({
        data: {
          startDate,
          endDate,
          projectId: selectedProjectId,
          staffSection: selectedStaffSection,
        },
      }),
    enabled: isPrivileged,
  });

  const filteredSessions = useMemo(() => {
    if (!reportData?.sessions) return [];
    if (!searchQuery.trim()) return reportData.sessions;
    const q = searchQuery.toLowerCase();
    return reportData.sessions.filter(
      (s) =>
        s.project_name.toLowerCase().includes(q) ||
        (s.user_name && s.user_name.toLowerCase().includes(q)) ||
        (s.task_summary && s.task_summary.toLowerCase().includes(q)) ||
        s.status.toLowerCase().includes(q),
    );
  }, [reportData?.sessions, searchQuery]);

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading project portal…
      </div>
    );
  }

  return (
    <AppShell session={session}>
      {/* Top Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isPrivileged ? "Project Management & Hours" : "My Assigned Projects"}
            </h1>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {session.role === "admin"
                ? "Admin Scope (All Projects)"
                : session.role === "sub_admin"
                ? "Team Lead / PM Scope"
                : "Employee Track"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isPrivileged
              ? "Track project-wise hours, team allocations, and daily deliverables."
              : "Review your assigned projects and session logs."}
          </p>
        </div>

        {isPrivileged && (
          <div className="flex rounded-lg border border-border/80 bg-card p-1 text-xs font-semibold shadow-sm">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                activeTab === "overview"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              Projects Overview
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-all ${
                activeTab === "reports"
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="size-3.5" />
              Hours & Session Reports
            </button>
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total Projects" value={projectsList.length} />
        <Stat
          label="Active Tracks"
          value={projectsList.filter((p) => p.status === "Active").length}
        />
        <Stat
          label="Logged Period Hours"
          value={reportData ? reportData.totalHours.toFixed(2) : "—"}
          suffix={reportData ? "h" : ""}
        />
        <Stat
          label="Recorded Sessions"
          value={reportData ? reportData.sessions.length : "—"}
        />
      </div>

      {/* TAB 1: Projects Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projectsList.map((proj) => (
              <div
                key={proj.id}
                className="flex flex-col justify-between rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-all hover:border-border hover:shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs font-mono font-semibold text-secondary-foreground">
                      {proj.code || "PROJ"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        proj.status === "Active"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          proj.status === "Active" ? "bg-emerald-500" : "bg-muted-foreground"
                        }`}
                      />
                      {proj.status}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-foreground">
                    {proj.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {proj.description || "Active business intelligence project."}
                  </p>
                </div>

                <div className="mt-5 space-y-2 border-t border-border/40 pt-4 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Project Lead:</span>
                    <span className="font-semibold text-foreground">
                      {proj.sub_admin_name || "Assigned PM"}
                    </span>
                  </div>
                  {proj.assigned_members_count !== undefined && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Assigned Staff:</span>
                      <span className="font-semibold text-foreground">
                        {proj.assigned_members_count} team members
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Hours & Session Reports (Admin & Sub-Admin) */}
      {activeTab === "reports" && isPrivileged && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                Filter Project Hours & Records
              </h2>
              <span className="text-xs text-muted-foreground">
                Showing {filteredSessions.length} sessions
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Start Date
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  End Date
                </span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Project
                </span>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="all">All Projects</option>
                  {projectsList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Staff Section
                </span>
                <select
                  value={selectedStaffSection}
                  onChange={(e) => setSelectedStaffSection(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                >
                  <option value="all">All Sections (IT Team & BI Staff)</option>
                  <option value="it_team">IT Team</option>
                  <option value="bi_staff">BI Staff</option>
                </select>
              </label>
            </div>

            {/* Quick Search */}
            <div className="relative pt-1">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by project, employee name, status, or task keywords..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-4 text-xs outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Aggregated Summaries: Project-wise & Employee-wise */}
          {reportData && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Project Hours Distribution */}
              <Panel
                title="Project Hours Distribution"
                hint="Total accumulated hours per project in selected period."
              >
                {reportData.projectSummary.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No hours logged for this period.</p>
                ) : (
                  <div className="space-y-4">
                    {reportData.projectSummary.map((item) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{item.name}</span>
                          <span className="font-mono font-bold text-primary">
                            {item.hours}h ({item.sessionCount} sessions)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                (item.hours / Math.max(reportData.totalHours, 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Employee Hours Contribution */}
              <Panel
                title="Employee Hours Contribution"
                hint="Total logged hours per employee across IT Team and BI Staff."
              >
                {reportData.employeeSummary.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">No employee logs recorded.</p>
                ) : (
                  <div className="space-y-4">
                    {reportData.employeeSummary.map((item) => (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">
                            {item.name}{" "}
                            <span className="text-[10px] uppercase font-normal text-muted-foreground">
                              ({item.section === "bi_staff" ? "BI Staff" : "IT Team"})
                            </span>
                          </span>
                          <span className="font-mono font-bold text-foreground">
                            {item.hours}h ({item.sessionCount} sessions)
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                (item.hours / Math.max(reportData.totalHours, 1)) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          )}

          {/* Detailed Sessions Table */}
          <Panel
            title="Project Session Records"
            hint="Exact timestamps, duration, and deliverable notes for every session."
          >
            {filteredSessions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No matching session records found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="pb-3 font-semibold">Date</th>
                      <th className="pb-3 font-semibold">Employee</th>
                      <th className="pb-3 font-semibold">Project</th>
                      <th className="pb-3 font-semibold">Time Window</th>
                      <th className="pb-3 font-semibold">Duration</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Deliverables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 font-medium">
                    {filteredSessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {sess.session_date}
                        </td>
                        <td className="py-3.5">
                          <div className="font-semibold text-foreground text-xs">
                            {sess.user_name || "Employee"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {sess.staff_section === "bi_staff" ? "BI Staff" : "IT Team"}
                          </div>
                        </td>
                        <td className="py-3.5 font-bold text-foreground text-xs">
                          {sess.project_name}
                        </td>
                        <td className="py-3.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {timeOnly(sess.start_time)} – {sess.end_time ? timeOnly(sess.end_time) : "Live"}
                        </td>
                        <td className="py-3.5 font-mono font-bold text-foreground text-xs whitespace-nowrap">
                          {formatSeconds(sess.duration_seconds || 0)}{" "}
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({((sess.duration_seconds || 0) / 3600).toFixed(2)}h)
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                              sess.status === "Completed"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : sess.status === "In Progress"
                                ? "bg-primary/15 text-primary"
                                : sess.status === "Paused"
                                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-xs text-muted-foreground max-w-xs truncate">
                          {sess.task_summary || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}
    </AppShell>
  );
}

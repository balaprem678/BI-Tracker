import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, useEffect } from "react";
import {
  FolderKanban,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Search,
  LayoutGrid,
  List,
  Plus,
  UserCheck,
  ChevronRight,
  Shield,
  BarChart3,
  X,
  Users,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { ProjectEditModal, ProjectDeleteModal } from "@/components/project-edit-modal";
import { toast } from "sonner";
import { getSessionInfo } from "@/lib/tracker.functions";
import { listEmployees } from "@/lib/admin.functions";
import {
  getMyProjects,
  getProjectHourlyReport,
  createProject,
  assignEmployeesToProject,
  updateProjectProgress,
  getAdminMonitoringOverview,
  Project,
} from "@/lib/project.functions";

export const Route = createFileRoute("/_authenticated/project")({
  head: () => ({
    meta: [
      { title: "Project Management & Hours — BI Tracker" },
      {
        name: "description",
        content:
          "Role-based project tracking, workforce allocations, and real-time session analytics.",
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

function ProjectPage() {
  const queryClient = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const myProjectsFn = useServerFn(getMyProjects);
  const projectReportFn = useServerFn(getProjectHourlyReport);
  const employeesFn = useServerFn(listEmployees);
  const createProjectFn = useServerFn(createProject);
  const assignEmployeesFn = useServerFn(assignEmployeesToProject);
  const updateProgressFn = useServerFn(updateProjectProgress);
  const adminMonitoringFn = useServerFn(getAdminMonitoringOverview);

  const today = todayIso(0);
  const weekAgo = todayIso(-7);

  // Tab & View Controls
  const [activeTab, setActiveTab] = useState<"projects" | "monitoring" | "reports">("projects");
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("bi_tracker_project_view_mode");
      if (saved === "list" || saved === "grid") return saved;
    }
    return "grid";
  });

  // Filter States
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [selectedStaffSection, setSelectedStaffSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals & Drawers
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [selectedProjectForAssign, setSelectedProjectForAssign] = useState<Project | null>(null);
  const [selectedProjectForProgress, setSelectedProjectForProgress] = useState<Project | null>(null);
  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null);
  const [selectedProjectForDelete, setSelectedProjectForDelete] = useState<Project | null>(null);
  const [drillDownProject, setDrillDownProject] = useState<any | null>(null);

  // Form States
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectCode, setNewProjectCode] = useState("");
  const [newProjectPriority, setNewProjectPriority] = useState<"Low" | "Medium" | "High" | "Urgent">("Medium");
  const [newProjectDeadline, setNewProjectDeadline] = useState("");
  const [newProjectEstHours, setNewProjectEstHours] = useState(0);
  const [newProjectAssignedSubAdmin, setNewProjectAssignedSubAdmin] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Assign Team State
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

  // Update Progress State
  const [updateStatus, setUpdateStatus] = useState<"Not Started" | "In Progress" | "Completed" | "Delayed">("In Progress");
  const [updatePercent, setUpdatePercent] = useState<number>(0);



  const handleToggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("bi_tracker_project_view_mode", mode);
  };

  // Queries
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: () => sessionFn({}),
  });

  const isAdmin = session?.role === "admin";
  const isSubAdmin = session?.role === "sub_admin";
  const isPrivileged = isAdmin || isSubAdmin;

  const { data: projectsList = [], isLoading: projectsLoading } = useQuery({
    queryKey: ["my-projects", session?.role],
    queryFn: () => myProjectsFn({}),
    enabled: !!session,
  });

  const { data: allEmployeesList = [] } = useQuery({
    queryKey: ["all-employees-list"],
    queryFn: () => employeesFn({}),
    enabled: isPrivileged,
  });

  const { data: adminMonitoringData } = useQuery({
    queryKey: ["admin-monitoring-overview"],
    queryFn: () => adminMonitoringFn({}),
    enabled: isAdmin && activeTab === "monitoring",
  });

  const { data: reportData } = useQuery({
    queryKey: ["project-hourly-report", startDate, endDate, selectedProjectId, selectedStaffSection],
    queryFn: () =>
      projectReportFn({
        data: {
          startDate,
          endDate,
          projectId: selectedProjectId,
          staffSection: selectedStaffSection,
        },
      }),
    enabled: isPrivileged && activeTab === "reports",
  });

  const subAdminOptions = useMemo(() => {
    return allEmployeesList.filter((e) => e.role === "sub_admin");
  }, [allEmployeesList]);

  const employeeOptions = useMemo(() => {
    return allEmployeesList.filter((e) => e.role === "employee");
  }, [allEmployeesList]);

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: (data: Parameters<typeof createProjectFn>[0]["data"]) => createProjectFn({ data }),
    onSuccess: (res) => {
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ["my-projects"] });
        queryClient.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
        setFormSuccess(res.message);
        setTimeout(() => {
          setShowCreateModal(false);
          setFormSuccess("");
          setNewProjectName("");
          setNewProjectCode("");
          setNewProjectDesc("");
          setNewProjectDeadline("");
          setNewProjectEstHours(0);
          setNewProjectAssignedSubAdmin("");
        }, 1200);
      } else {
        setFormError("Could not create project.");
      }
    },
    onError: (err: any) => setFormError(err.message),
  });

  const assignEmployeesMutation = useMutation({
    mutationFn: (data: { projectId: string; employeeIds: string[] }) =>
      assignEmployeesFn({ data }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Team assignments updated successfully.");
        queryClient.invalidateQueries({ queryKey: ["my-projects"] });
        queryClient.refetchQueries({ queryKey: ["my-projects"] });
        queryClient.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
        queryClient.invalidateQueries({ queryKey: ["admin-all-projects"] });
        setShowAssignModal(false);
      } else {
        toast.error((res as any)?.message || "Failed to assign team members.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to assign team members.");
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: (data: { projectId: string; status: any; progressPercent: number }) =>
      updateProgressFn({ data }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message || "Project progress updated successfully.");
        queryClient.invalidateQueries({ queryKey: ["my-projects"] });
        queryClient.refetchQueries({ queryKey: ["my-projects"] });
        queryClient.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
        queryClient.invalidateQueries({ queryKey: ["admin-all-projects"] });
        queryClient.invalidateQueries({ queryKey: ["project-hourly-report"] });
        setShowProgressModal(false);
      } else {
        toast.error((res as any)?.message || "Failed to update project progress.");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update project progress. Please try again.");
    },
  });

  // Filter Projects by Search
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projectsList;
    const q = searchQuery.toLowerCase();
    return projectsList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        (p.sub_admin_name && p.sub_admin_name.toLowerCase().includes(q)),
    );
  }, [projectsList, searchQuery]);

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading project management portal…
      </div>
    );
  }

  return (
    <AppShell session={session}>
      {/* Header Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {isAdmin
                ? "Admin Project Management & Monitoring"
                : isSubAdmin
                ? "Sub-Admin Project & Team Portal"
                : "My Assigned Projects"}
            </h1>
            <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {isAdmin ? "Admin Scope (All Projects)" : isSubAdmin ? "Sub-Admin Scope" : "Employee Assigned Scope"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAdmin
              ? "Create projects, assign Sub-Admins, and monitor real-time workforce analytics."
              : isSubAdmin
              ? "Manage assigned projects, assign employees, and track deliverables."
              : "Track your assigned project tasks, progress %, and daily session logs."}
          </p>
        </div>

        {/* Tab & View Mode Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* List/Grid View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => handleToggleViewMode("grid")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Grid View"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
            <button
              onClick={() => handleToggleViewMode("list")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="List View"
            >
              <List className="h-3.5 w-3.5" />
              List
            </button>
          </div>

          {/* Action Buttons */}
          {isAdmin && (
            <button
              onClick={() => {
                setShowCreateModal(true);
                setFormError("");
                setFormSuccess("");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Create New Project
            </button>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center rounded-lg border border-border bg-card p-1">
            <button
              onClick={() => setActiveTab("projects")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "projects"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              Projects
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab("monitoring")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "monitoring"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Monitoring
              </button>
            )}

            {isPrivileged && (
              <button
                onClick={() => setActiveTab("reports")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  activeTab === "reports"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Reports & Hours
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          TAB 1: PROJECTS (GRID / LIST VIEW)
         ======================================================== */}
      {activeTab === "projects" && (
        <div className="space-y-6">
          {/* Quick Metrics Header */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="TOTAL PROJECTS" value={projectsList.length} />
            <Stat
              label="COMPLETED PROJECTS"
              value={projectsList.filter((p) => p.status === "Completed" || p.progress_percent === 100).length}
            />
            <Stat
              label="IN PROGRESS"
              value={projectsList.filter((p) => p.status === "In Progress").length}
            />
            <Stat
              label="DELAYED / OVERDUE"
              value={projectsList.filter((p) => p.status === "Delayed").length}
            />
          </div>

          {/* Search & Filter Toolbar */}
          <Panel title="Filter & Search Projects">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search projects by name, code, description, or Sub-Admin..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Showing <strong className="text-foreground">{filteredProjects.length}</strong> of {projectsList.length} projects
              </div>
            </div>
          </Panel>

          {/* Project List / Grid Container */}
          {projectsLoading ? (
            <div className="grid place-items-center p-12 text-sm text-muted-foreground">
              Loading projects...
            </div>
          ) : filteredProjects.length === 0 ? (
            <Panel title="Projects">
              <div className="p-8 text-center">
                <FolderKanban className="mx-auto h-12 w-12 text-muted-foreground/40" />
                <h3 className="mt-3 text-sm font-semibold">No Projects Found</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {searchQuery ? "No projects match your search query." : "No projects assigned to your account yet."}
                </p>
              </div>
            </Panel>
          ) : viewMode === "grid" ? (
            /* GRID VIEW */
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <Panel key={project.id} title={project.code || "PROJECT"} className="group relative flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-md">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          project.status === "Completed"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : project.status === "In Progress"
                            ? "bg-blue-500/10 text-blue-500 border border-blue-500/20"
                            : project.status === "Delayed"
                            ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        ● {project.status}
                      </span>
                    </div>

                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                      {project.description || "No description provided."}
                    </p>

                    {/* Progress Bar */}
                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between text-[11px] font-medium">
                        <span className="text-muted-foreground">Completion Progress</span>
                        <span className="font-bold text-foreground">{project.progress_percent || 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full transition-all duration-500 ${
                            project.progress_percent >= 100
                              ? "bg-emerald-500"
                              : project.status === "Delayed"
                              ? "bg-rose-500"
                              : "bg-primary"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, project.progress_percent || 0))}%` }}
                        />
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/50 pt-3 text-[11px]">
                      <div>
                        <span className="text-muted-foreground block">Assigned Sub-Admin</span>
                        <span className="font-medium text-foreground">{project.sub_admin_name}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Assigned Team</span>
                        <span className="font-medium text-foreground">{project.assigned_members_count || 0} employees</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Logged Hours</span>
                        <span className="font-medium text-foreground">{project.logged_hours || 0} hrs</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block">Priority</span>
                        <span
                          className={`font-semibold ${
                            project.priority === "Urgent"
                              ? "text-rose-500"
                              : project.priority === "High"
                              ? "text-amber-500"
                              : "text-foreground"
                          }`}
                        >
                          {project.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                    <div className="flex items-center gap-2">
                      {(isAdmin || (isSubAdmin && project.assigned_sub_admin_id === session.userId)) && (
                        <button
                          onClick={() => {
                            setSelectedProjectForAssign(project);
                            setSelectedEmployeeIds(
                              (project.assigned_employees || []).map((e) => e.id),
                            );
                            setShowAssignModal(true);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          Assign Team
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedProjectForProgress(project);
                          setUpdateStatus(project.status as any);
                          setUpdatePercent(project.progress_percent || 0);
                          setShowProgressModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <TrendingUp className="h-3.5 w-3.5" />
                        Progress
                      </button>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedProjectForEdit(project)}
                          title="Edit Project"
                          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setSelectedProjectForDelete(project)}
                          title="Delete Project"
                          className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            /* LIST VIEW */
            <Panel title="Projects Directory">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Code / Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Progress</th>
                      <th className="px-4 py-3">Sub-Admin</th>
                      <th className="px-4 py-3">Team Size</th>
                      <th className="px-4 py-3">Logged Hours</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredProjects.map((project) => (
                      <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-foreground">{project.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {project.code || `PRJ-${project.id.slice(0, 4).toUpperCase()}`}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              project.status === "Completed"
                                ? "bg-emerald-500/10 text-emerald-500"
                                : project.status === "In Progress"
                                ? "bg-blue-500/10 text-blue-500"
                                : project.status === "Delayed"
                                ? "bg-rose-500/10 text-rose-500"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {project.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${Math.min(100, Math.max(0, project.progress_percent || 0))}%` }}
                              />
                            </div>
                            <span className="font-semibold text-[11px]">{project.progress_percent || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-medium">{project.sub_admin_name}</td>
                        <td className="px-4 py-3.5">{project.assigned_members_count || 0} members</td>
                        <td className="px-4 py-3.5 font-mono">{project.logged_hours || 0} hrs</td>
                        <td className="px-4 py-3.5 font-semibold">{project.priority}</td>
                        <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                          {(isAdmin || (isSubAdmin && project.assigned_sub_admin_id === session.userId)) && (
                            <button
                              onClick={() => {
                                setSelectedProjectForAssign(project);
                                setSelectedEmployeeIds(
                                  (project.assigned_employees || []).map((e) => e.id),
                                );
                                setShowAssignModal(true);
                              }}
                              className="rounded border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                            >
                              Assign
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedProjectForProgress(project);
                              setUpdateStatus(project.status as any);
                              setUpdatePercent(project.progress_percent || 0);
                              setShowProgressModal(true);
                            }}
                            className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                          >
                            Update
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setSelectedProjectForEdit(project)}
                                title="Edit Project"
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                              >
                                <Pencil className="size-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => setSelectedProjectForDelete(project)}
                                title="Delete Project"
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] font-medium text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="size-3" />
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ========================================================
          TAB 2: ADMIN MONITORING & HIERARCHY (ADMIN ONLY)
         ======================================================== */}
      {activeTab === "monitoring" && isAdmin && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="TOTAL SYSTEM SUB-ADMINS" value={adminMonitoringData?.totalSubAdminsCount || 0} />
            <Stat label="TOTAL SYSTEM EMPLOYEES" value={adminMonitoringData?.totalEmployeesCount || 0} />
            <Stat label="MONITORED PROJECTS" value={adminMonitoringData?.totalProjectsCount || 0} />
          </div>

          {/* Sub-Admin -> Employee Hierarchy Overview */}
          <Panel
            title="Sub-Admin & Employee Allocation Hierarchy"
            hint="Overview of Sub-Admins, their assigned project deliverables, and team members assigned under each section."
          >
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              {(adminMonitoringData?.subAdminHierarchy || []).map((item: any) => (
                <div key={item.subAdmin.id} className="rounded-xl border border-border bg-card/50 p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {item.subAdmin.full_name?.slice(0, 2).toUpperCase() || "SA"}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{item.subAdmin.full_name}</h4>
                        <p className="text-[11px] text-muted-foreground">{item.subAdmin.email}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      Sub-Admin
                    </span>
                  </div>

                  {/* Assigned Projects */}
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Assigned Projects ({item.projects.length})
                    </h5>
                    {item.projects.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No projects assigned yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {item.projects.map((p: any) => (
                          <div key={p.id} className="flex items-center justify-between rounded-lg bg-background p-2.5 border border-border/50 text-xs">
                            <span className="font-semibold text-foreground">{p.name}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-muted-foreground">{p.logged_hours || 0} hrs</span>
                              <span className="font-bold text-primary">{p.progress_percent || 0}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Assigned Employees */}
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Assigned Team Employees ({item.assignedEmployees.length})
                    </h5>
                    <div className="flex flex-wrap gap-2">
                      {item.assignedEmployees.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">No employees assigned to Sub-Admin projects.</p>
                      ) : (
                        item.assignedEmployees.map((emp: any) => (
                          <span key={emp.id} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {emp.full_name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Project Lineage & History Table with Drill-down */}
          <Panel
            title="System Projects Lineage & History"
            hint="Click any project row to inspect its full assignment chain, logged sessions, and progress metrics."
          >
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Project Name</th>
                    <th className="px-4 py-3">Sub-Admin</th>
                    <th className="px-4 py-3">Team Size</th>
                    <th className="px-4 py-3">Progress %</th>
                    <th className="px-4 py-3">Logged Hours</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Drill Down</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {(adminMonitoringData?.allProjects || []).map((proj: any) => (
                    <tr
                      key={proj.id}
                      onClick={() => setDrillDownProject(proj)}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-bold text-foreground">{proj.name}</td>
                      <td className="px-4 py-3.5">{proj.sub_admin_name}</td>
                      <td className="px-4 py-3.5">{proj.assigned_employees?.length || 0} members</td>
                      <td className="px-4 py-3.5 font-bold text-primary">{proj.progress_percent || 0}%</td>
                      <td className="px-4 py-3.5 font-mono">{proj.logged_hours || 0} hrs</td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                          {proj.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* ========================================================
          TAB 3: REPORTS & HOURS
         ======================================================== */}
      {activeTab === "reports" && isPrivileged && (
        <div className="space-y-6">
          <Panel title="Report Filters">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded border border-input bg-background px-2.5 py-1 text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-muted-foreground">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded border border-input bg-background px-2.5 py-1 text-xs"
                />
              </div>
            </div>
          </Panel>

          <Panel title="Logged Hours Summary" hint={`Total logged hours: ${reportData?.totalHours || 0} hrs`}>
            <div className="p-4 text-xs text-muted-foreground">
              Project hourly analytics consolidated from live work sessions.
            </div>
          </Panel>
        </div>
      )}

      {/* ========================================================
          MODAL 1: CREATE NEW PROJECT (ADMIN ONLY)
         ======================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground">Create New Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {formError && <p className="text-xs text-rose-500 font-semibold">{formError}</p>}
            {formSuccess && <p className="text-xs text-emerald-500 font-semibold">{formSuccess}</p>}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Project Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Customer Portal Redesign"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Project Code</label>
                  <input
                    type="text"
                    placeholder="e.g. CPR-01"
                    value={newProjectCode}
                    onChange={(e) => setNewProjectCode(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Priority</label>
                  <select
                    value={newProjectPriority}
                    onChange={(e) => setNewProjectPriority(e.target.value as any)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Assign Sub-Admin Lead *</label>
                <select
                  value={newProjectAssignedSubAdmin}
                  onChange={(e) => setNewProjectAssignedSubAdmin(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium"
                >
                  <option value="">-- Select Sub-Admin --</option>
                  {subAdminOptions.map((sa) => (
                    <option key={sa.id} value={sa.id}>
                      {sa.full_name} ({sa.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Briefly describe objectives, deliverables, and scope..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  createProjectMutation.mutate({
                    name: newProjectName,
                    code: newProjectCode,
                    description: newProjectDesc,
                    priority: newProjectPriority,
                    assignedSubAdminId: newProjectAssignedSubAdmin,
                  });
                }}
                disabled={createProjectMutation.isPending || !newProjectName.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 2: ASSIGN TEAM TO PROJECT (SUB-ADMIN / ADMIN)
         ======================================================== */}
      {showAssignModal && selectedProjectForAssign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Assign Team Employees</h3>
                <p className="text-xs text-muted-foreground">{selectedProjectForAssign.name}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
              {employeeOptions.length === 0 ? (
                <p className="text-muted-foreground italic">No employees found.</p>
              ) : (
                employeeOptions.map((emp) => {
                  const isChecked = selectedEmployeeIds.includes(emp.id);
                  return (
                    <label
                      key={emp.id}
                      className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${
                        isChecked ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-foreground">{emp.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{emp.email}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                          } else {
                            setSelectedEmployeeIds(selectedEmployeeIds.filter((id) => id !== emp.id));
                          }
                        }}
                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                      />
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  assignEmployeesMutation.mutate({
                    projectId: selectedProjectForAssign.id,
                    employeeIds: selectedEmployeeIds,
                  });
                }}
                disabled={assignEmployeesMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {assignEmployeesMutation.isPending ? "Saving..." : "Save Team Assignments"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL 3: UPDATE PROJECT PROGRESS (ALL ROLES)
         ======================================================== */}
      {showProgressModal && selectedProjectForProgress && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Update Progress</h3>
                <p className="text-xs text-muted-foreground">{selectedProjectForProgress.name}</p>
              </div>
              <button onClick={() => setShowProgressModal(false)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Status</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs"
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delayed">Delayed</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between font-semibold text-foreground mb-1">
                  <span>Completion Percentage</span>
                  <span>{updatePercent}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={updatePercent}
                  onChange={(e) => setUpdatePercent(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <button
                onClick={() => setShowProgressModal(false)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  updateProgressMutation.mutate({
                    projectId: selectedProjectForProgress.id,
                    status: updateStatus,
                    progressPercent: updatePercent,
                  });
                }}
                disabled={updateProgressMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {updateProgressMutation.isPending ? "Updating..." : "Save Progress"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          DRAWER: DRILL-DOWN PROJECT DETAILS (ADMIN MONITORING)
         ======================================================== */}
      {drillDownProject && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border-l border-border h-full p-6 overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="font-mono text-xs text-muted-foreground">{drillDownProject.code || "PROJECT DETAILS"}</span>
                <h3 className="text-lg font-bold text-foreground">{drillDownProject.name}</h3>
              </div>
              <button onClick={() => setDrillDownProject(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <button
                  onClick={() => {
                    setSelectedProjectForEdit(drillDownProject);
                    setDrillDownProject(null);
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary py-2 text-xs font-semibold hover:bg-secondary/80 transition-colors"
                >
                  <Pencil className="size-3.5 text-primary" />
                  Edit Project Details
                </button>
                <button
                  onClick={() => {
                    setSelectedProjectForDelete(drillDownProject);
                    setDrillDownProject(null);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              </div>
            )}

            {/* Lineage Mapping */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Assignment Lineage</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Sub-Admin Lead:</span>
                  <span className="font-bold text-foreground">{drillDownProject.sub_admin_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Assigned Employees:</span>
                  <span className="font-bold text-foreground">
                    {drillDownProject.assigned_employees?.length || 0} members
                  </span>
                </div>
              </div>
            </div>

            {/* Session History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Logged Work Sessions</h4>
              {(drillDownProject.sessions_history || []).length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No work sessions logged for this project yet.</p>
              ) : (
                <div className="space-y-2">
                  {drillDownProject.sessions_history.map((s: any) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 text-xs space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span>{s.session_date}</span>
                        <span className="font-mono text-primary">{formatSeconds(s.duration_seconds)}</span>
                      </div>
                      <p className="text-muted-foreground">{s.task_summary || "Session in progress or completed."}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PROJECT EDIT & DELETE MODALS */}
      <ProjectEditModal
        project={selectedProjectForEdit}
        subAdmins={subAdminOptions}
        isOpen={!!selectedProjectForEdit}
        onClose={() => setSelectedProjectForEdit(null)}
      />

      <ProjectDeleteModal
        project={selectedProjectForDelete}
        isOpen={!!selectedProjectForDelete}
        onClose={() => setSelectedProjectForDelete(null)}
      />
    </AppShell>
  );
}

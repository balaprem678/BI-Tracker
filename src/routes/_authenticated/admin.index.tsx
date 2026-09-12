import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  KeyRound,
  ShieldCheck,
  UserPlus,
  Users,
  FolderKanban,
  Pencil,
  Trash2,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  createEmployee,
  listEmployees,
  setEmployeeActive,
} from "@/lib/admin.functions";
import { getMyProjects, type Project } from "@/lib/project.functions";
import { ProjectEditModal, ProjectDeleteModal } from "@/components/project-edit-modal";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Console — BI Tracker" },
      {
        name: "description",
        content: "Issue employee accounts, manage permissions, and configure workforce access.",
      },
      { property: "og:title", content: "Admin Console — BI Tracker" },
    ],
  }),
  component: AdminPanel,
});

function SectionBreakdown({ itCount, biCount }: { itCount: number; biCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
      <span>
        IT Team: <strong className="font-semibold text-foreground">{itCount}</strong>
      </span>
      <span className="text-muted-foreground/40">•</span>
      <span>
        BI Staff: <strong className="font-semibold text-foreground">{biCount}</strong>
      </span>
    </div>
  );
}

function AdminPanel() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listEmployees);
  const createFn = useServerFn(createEmployee);
  const activeFn = useServerFn(setEmployeeActive);
  const myProjectsFn = useServerFn(getMyProjects);

  const [selectedProjectForEdit, setSelectedProjectForEdit] = useState<Project | null>(null);
  const [selectedProjectForDelete, setSelectedProjectForDelete] = useState<Project | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    jobTitle: "",
    department: "",
    staffSection: "IT Team" as "IT Team" | "BI Staff",
    hourlyRate: "0",
    role: "employee" as "employee" | "admin" | "sub_admin",
  });

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => listFn({}),
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          jobTitle: form.jobTitle,
          department: form.department,
          staffSection: form.staffSection,
          hourlyRate: Number(form.hourlyRate) || 0,
          role: form.role,
        },
      }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setForm({
        ...form,
        email: "",
        password: "",
        fullName: "",
        jobTitle: "",
        department: "",
        staffSection: "IT Team",
        hourlyRate: "0",
        role: "employee",
      });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: () => toast.error("Could not create that account."),
  });

  const activeMutation = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });

  const { data: projectsList = [] } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => myProjectsFn({}),
  });

  const subAdminOptions = useMemo(() => {
    return (employees ?? []).filter((e) => e.role === "sub_admin");
  }, [employees]);

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading admin console…
      </div>
    );
  }

  if (session.role !== "admin") {
    return (
      <AppShell session={session}>
        <Panel title="Restricted">
          <p className="text-sm text-muted-foreground">
            This area is for administrators only.
          </p>
        </Panel>
      </AppShell>
    );
  }

  const allList = employees ?? [];
  const totalEmployees = allList.length;
  const totalIt = allList.filter((e) => e.staff_section !== "BI Staff").length;
  const totalBi = allList.filter((e) => e.staff_section === "BI Staff").length;

  const clockedInEmployees = allList.filter((e) => e.is_clocked_in);
  const activeLoginsTotal = clockedInEmployees.length;
  const activeIt = clockedInEmployees.filter((e) => e.staff_section !== "BI Staff").length;
  const activeBi = clockedInEmployees.filter((e) => e.staff_section === "BI Staff").length;

  const adminEmployees = allList.filter((e) => e.role === "admin" || e.role === "sub_admin");
  const totalAdmins = adminEmployees.length;
  const adminIt = adminEmployees.filter((e) => e.staff_section !== "BI Staff").length;
  const adminBi = adminEmployees.filter((e) => e.staff_section === "BI Staff").length;

  return (
    <AppShell session={session}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Admin Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Issue employee accounts, manage permissions, and assign workforce roles.
          </p>
        </div>

        <Link
          to="/team"
          className="inline-flex items-center gap-2 rounded-md bg-secondary px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          <Users className="size-4 text-primary" />
          View Team & Hourly Report <ArrowRight className="size-3.5" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Total issued accounts"
          value={totalEmployees}
          breakdown={<SectionBreakdown itCount={totalIt} biCount={totalBi} />}
        />
        <Stat
          label="Active logins"
          value={activeLoginsTotal}
          breakdown={<SectionBreakdown itCount={activeIt} biCount={activeBi} />}
        />
        <Stat
          label="Administrators & Sub Admins"
          value={totalAdmins}
          breakdown={<SectionBreakdown itCount={adminIt} biCount={adminBi} />}
        />
        <Stat
          label="Total Projects"
          value={projectsList.length}
          breakdown={
            <span className="text-xs text-muted-foreground">
              <strong className="font-semibold text-foreground">
                {projectsList.filter((p) => p.status === "In Progress").length}
              </strong>{" "}
              in progress
            </span>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel
          title="Create employee account"
          hint="There is no public sign-up — you issue credentials directly."
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-3"
          >
            <Field
              id="create-employee-fullName"
              label="Full name"
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
            />
            <Field
              label="Work email"
              type="email"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
            />
            <Field
              label="Temporary password (min 8 characters)"
              type="password"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Job title"
                required={false}
                value={form.jobTitle}
                onChange={(v) => setForm({ ...form, jobTitle: v })}
              />
              <Field
                label="Department / Team"
                required={false}
                value={form.department}
                onChange={(v) => setForm({ ...form, department: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Staff Section
                </span>
                <select
                  value={form.staffSection}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      staffSection: e.target.value as "IT Team" | "BI Staff",
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="IT Team">IT Team</option>
                  <option value="BI Staff">BI Staff</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Access Role
                </span>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      role: e.target.value as "employee" | "admin" | "sub_admin",
                    })
                  }
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                >
                  <option value="employee">Employee</option>
                  <option value="sub_admin">Sub Admin</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <UserPlus className="size-4" />
              {createMutation.isPending ? "Creating account…" : "Create account"}
            </button>
          </form>
        </Panel>

        <div className="space-y-6">
          {/* Quick Notice Card */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary shrink-0">
                <Users className="size-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Team & Hourly Report Moved</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  All team member directories, live attendance tracking, and date-range hourly reports have been centralized in the <strong>Team</strong> tab for quick access.
                </p>
                <Link
                  to="/team"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  Open Team Tab <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Account Activation Manager */}
          <Panel
            title="Account Status Manager"
            hint="Quickly enable or disable user login access."
          >
            <div className="max-h-72 overflow-y-auto divide-y divide-border">
              {(employees ?? []).map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="font-medium text-foreground truncate">{e.full_name || e.email}</p>
                    <p className="text-muted-foreground truncate">{e.email || "No email"}</p>
                  </div>
                  <Link
                    to="/admin/employee/$id"
                    params={{ id: e.id }}
                    className="shrink-0 rounded-md border border-border px-2 py-1 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() =>
                      activeMutation.mutate({ id: e.id, active: !e.is_active })
                    }
                    className={`shrink-0 rounded-md border px-2 py-1 transition-colors ${
                      e.is_active
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {e.is_active ? "Active" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* SYSTEM PROJECTS MANAGEMENT PANEL */}
      <div className="mt-8">
        <Panel
          title="System Projects Management"
          hint="Edit project details, assign Sub-Admin leads, or remove projects across the workforce."
          action={
            <Link
              to="/project"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              <FolderKanban className="size-3.5" />
              Open Projects Studio <ArrowRight className="size-3" />
            </Link>
          }
        >
          {projectsList.length === 0 ? (
            <div className="py-8 text-center">
              <FolderKanban className="mx-auto size-10 text-muted-foreground/40" />
              <p className="mt-2 text-xs font-medium text-foreground">No projects created yet</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Create new projects in the Projects section to assign workforce and track hours.
              </p>
              <Link
                to="/project"
                className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Go to Projects <ArrowRight className="size-3" />
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 font-semibold text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Project Code / Name</th>
                    <th className="px-4 py-3">Sub-Admin Lead</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Logged Hours</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {projectsList.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-foreground">{p.name}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {p.code || `PRJ-${p.id.slice(0, 4).toUpperCase()}`}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium">{p.sub_admin_name || "Unassigned"}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            p.status === "Completed"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : p.status === "In Progress"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              : p.status === "Delayed"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          ● {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`font-semibold ${
                            p.priority === "Urgent"
                              ? "text-rose-500"
                              : p.priority === "High"
                              ? "text-amber-500"
                              : "text-foreground"
                          }`}
                        >
                          {p.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, Math.max(0, p.progress_percent || 0))}%` }}
                            />
                          </div>
                          <span className="font-semibold text-[11px]">{p.progress_percent || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-mono">{p.logged_hours || 0} hrs</td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedProjectForEdit(p)}
                            title="Edit Project"
                            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <Pencil className="size-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => setSelectedProjectForDelete(p)}
                            title="Delete Project"
                            className="inline-flex items-center gap-1 rounded border border-border px-2.5 py-1 text-[11px] font-medium text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="size-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

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

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  id?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

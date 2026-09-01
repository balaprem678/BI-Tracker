import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, KeyRound, ShieldCheck, UserPlus, Users } from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  createEmployee,
  listEmployees,
  setEmployeeActive,
} from "@/lib/admin.functions";

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

function AdminPanel() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listEmployees);
  const createFn = useServerFn(createEmployee);
  const activeFn = useServerFn(setEmployeeActive);

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
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listFn({}) });

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

  const totalEmployees = employees?.length ?? 0;
  const activeEmployees = (employees ?? []).filter((e) => e.is_active).length;
  const totalAdmins = (employees ?? []).filter((e) => e.role === "admin" || e.role === "sub_admin").length;

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

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Total issued accounts" value={totalEmployees} />
        <Stat label="Active logins" value={activeEmployees} />
        <Stat label="Administrators & Sub Admins" value={totalAdmins} />
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
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}

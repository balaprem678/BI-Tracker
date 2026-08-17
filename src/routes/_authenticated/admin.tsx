import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  createEmployee,
  getHourlyReport,
  listEmployees,
  setEmployeeActive,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({ component: AdminPanel });

function isoDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function AdminPanel() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(listEmployees);
  const createFn = useServerFn(createEmployee);
  const activeFn = useServerFn(setEmployeeActive);
  const reportFn = useServerFn(getHourlyReport);

  const [from, setFrom] = useState(isoDate(-6));
  const [to, setTo] = useState(isoDate());
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    jobTitle: "",
    department: "",
    hourlyRate: "0",
    role: "employee" as "employee" | "admin" | "sub_admin",
  });

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const { data: employees } = useQuery({ queryKey: ["employees"], queryFn: () => listFn({}) });
  const { data: report } = useQuery({
    queryKey: ["report", from, to],
    queryFn: () => reportFn({ data: { from, to } }),
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
      setForm({ ...form, email: "", password: "", fullName: "", jobTitle: "" });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: () => toast.error("Could not create that account."),
  });

  const activeMutation = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => activeFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
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

  const totalHours = (report ?? []).reduce((s, r) => s + r.hoursWorked, 0);
  const totalCost = (report ?? []).reduce((s, r) => s + r.cost, 0);
  const totalLogged = (report ?? []).reduce((s, r) => s + r.loggedHours, 0);

  return (
    <AppShell session={session}>
      <h1 className="text-3xl font-semibold">Admin panel</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Issue accounts, review hours and read the hourly activity report.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Team members" value={employees?.length ?? 0} />
        <Stat label="Hours in range" value={totalHours.toFixed(2)} suffix="h" />
        <Stat label="Hours logged" value={totalLogged} />
        <Stat label="Labour cost" value={totalCost.toFixed(2)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Create employee account" hint="There is no public sign-up — you issue logins.">
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
              label="Temporary password (min 8)"
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
                label="Project / Team"
                required={false}
                value={form.department}
                onChange={(v) => setForm({ ...form, department: v })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Hourly rate"
                type="number"
                value={form.hourlyRate}
                onChange={(v) => setForm({ ...form, hourlyRate: v })}
              />
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Role
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
                  <option value="employee">employee</option>
                  <option value="admin">admin</option>
                  <option value="sub_admin">sub admin</option>
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <UserPlus className="size-4" />
              {createMutation.isPending ? "Creating…" : "Create account"}
            </button>
          </form>
        </Panel>

        <Panel title="Team">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Rate</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(employees ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="py-3">
                      <p>{e.full_name || e.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.email && e.full_name ? e.email : e.job_title ?? "—"}
                        {e.email && e.full_name && e.job_title ? ` · ${e.job_title}` : ""}
                        {e.department ? ` · ${e.department}` : ""}
                      </p>
                    </td>
                    <td className="py-3 text-primary">
                      {e.role === "sub_admin" ? "sub admin" : e.role}
                    </td>
                    <td className="stat-number py-3">{e.hourly_rate.toFixed(2)}</td>
                    <td className="py-3">
                      <button
                        onClick={() =>
                          activeMutation.mutate({ id: e.id, active: !e.is_active })
                        }
                        className={`rounded-md border border-border px-2.5 py-1 text-xs transition-colors hover:bg-secondary ${
                          e.is_active ? "text-success" : "text-muted-foreground"
                        }`}
                      >
                        {e.is_active ? "active" : "inactive"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title="Hourly report"
        hint="Hours worked, labour cost and every logged hour per person."
        action={
          <div className="flex items-end gap-2">
            <label className="text-xs text-muted-foreground">
              From
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              To
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 block rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
        }
      >
        <div className="space-y-3">
          {(report ?? []).map((r) => (
            <details key={r.userId} className="rounded-md border border-border bg-surface-2/40 p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.department ?? "—"}</span>
                <span className="stat-number ml-auto text-primary">
                  clock {r.hoursWorked.toFixed(2)} h
                </span>
                <span className="stat-number text-muted-foreground">{r.loggedHours} logged h</span>
                <span className="stat-number">{r.cost.toFixed(2)}</span>
              </summary>

              {r.shifts.length > 0 && (
                <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                  {r.shifts.map((s, i) => (
                    <li
                      key={`${r.userId}-shift-${i}`}
                      className="flex flex-wrap items-center gap-3 px-3 py-2 text-xs"
                    >
                      <span className="stat-number w-24">{s.date}</span>
                      <span className="text-muted-foreground">
                        In {new Date(s.clockIn).toLocaleTimeString()} · Out{" "}
                        {s.clockOut ? new Date(s.clockOut).toLocaleTimeString() : "—"}
                      </span>
                      <span className="stat-number ml-auto">
                        {s.clockOut ? `${s.hours.toFixed(2)} h` : "in progress"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {r.logs.length > 0 ? (
                <ul className="mt-3 divide-y divide-border">
                  {r.logs.map((l, i) => (
                    <li key={`${r.userId}-${i}`} className="flex flex-wrap gap-3 py-2 text-sm">
                      <span className="stat-number w-20 shrink-0 text-muted-foreground">
                        {l.log_date}
                      </span>
                      <span className="stat-number w-24 shrink-0 text-primary">
                        {(l.start_time ?? `${String(l.hour_slot).padStart(2, "0")}:00`).slice(0, 5)}
                        {" – "}
                        {(l.end_time ?? `${String((l.hour_slot + 1) % 24).padStart(2, "0")}:00`).slice(
                          0,
                          5,
                        )}
                      </span>
                      <span className="min-w-40 flex-1">
                        {l.project ? <strong className="mr-1">{l.project}</strong> : null}
                        {l.task}
                      </span>
                      <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                        {l.status || l.category}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No hourly entries in range.</p>
              )}
            </details>
          ))}

          {(report ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No data for this range yet.</p>
          )}
        </div>
      </Panel>
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

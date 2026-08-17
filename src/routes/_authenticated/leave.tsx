import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Trash2 } from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import { cancelLeave, getMyLeaves, requestLeave } from "@/lib/leave.functions";
import { LEAVE_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({
    meta: [
      { title: "Leave Requests — BI Tracker" },
      {
        name: "description",
        content: "Request time off, track approval status and review your leave history.",
      },
      { property: "og:title", content: "Leave Requests — BI Tracker" },
      {
        property: "og:description",
        content: "Submit and follow up on your BI Tracker leave requests.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeavePage,
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function days(a: string, b: string) {
  return Math.max(
    1,
    Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1,
  );
}

function LeavePage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const listFn = useServerFn(getMyLeaves);
  const createFn = useServerFn(requestLeave);
  const cancelFn = useServerFn(cancelLeave);

  const [form, setForm] = useState({
    startDate: todayIso(),
    endDate: todayIso(),
    leaveType: LEAVE_TYPES[0] as string,
    reason: "",
  });

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const { data: leaves } = useQuery({ queryKey: ["my-leaves"], queryFn: () => listFn() });

  const create = useMutation({
    mutationFn: () => createFn({ data: form }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }

      toast.success(res.message);
      setForm({ ...form, reason: "" });
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: () => toast.error("Could not submit that request."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-leaves"] }),
  });

  if (!session) return null;

  const pending = (leaves ?? []).filter((l) => l.status === "Pending").length;
  const totalDays = (leaves ?? []).reduce((s, l) => s + days(l.start_date, l.end_date), 0);

  return (
    <AppShell session={session}>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Leave</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Request time off and track where each request stands.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Requests" value={leaves?.length ?? 0} />
        <Stat label="Pending" value={pending} />
        <Stat label="Days requested" value={totalDays} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Panel title="Request leave" hint="Your admin reviews and approves requests.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  From
                </span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  To
                </span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Leave type
              </span>
              <select
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Reason
              </span>
              <textarea
                rows={3}
                maxLength={500}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <CalendarDays className="size-4" />
              Submit request
            </button>
          </form>
        </Panel>

        <Panel title="My leave history">
          {leaves && leaves.length > 0 ? (
            <ul className="divide-y divide-border">
              {leaves.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="stat-number">
                    {l.start_date}
                    {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                  </span>
                  <span className="rounded-md border border-border px-2 py-0.5 text-xs">
                    {l.leave_type}
                  </span>
                  <span
                    className={`text-xs uppercase tracking-widest ${
                      l.status === "Approved"
                        ? "text-success"
                        : l.status === "Rejected"
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
                    {l.status}
                  </span>
                  <span className="w-full text-xs text-muted-foreground sm:w-auto sm:flex-1">
                    {l.reason || "—"}
                  </span>
                  <button
                    onClick={() => remove.mutate(l.id)}
                    aria-label="Cancel request"
                    className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-sm text-muted-foreground">No leave requests yet.</p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

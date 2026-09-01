import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageSquareQuote,
  Trash2,
  XCircle,
} from "lucide-react";
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
  const { data: leaves } = useQuery({
    queryKey: ["my-leaves"],
    queryFn: () => listFn(),
    refetchInterval: 8000,
  });

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
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      qc.invalidateQueries({ queryKey: ["my-leaves"] });
    },
    onError: () => toast.error("Could not cancel request."),
  });

  if (!session) return null;

  const pending = (leaves ?? []).filter((l) => l.status === "Pending").length;
  const approved = (leaves ?? []).filter((l) => l.status === "Approved").length;
  const rejected = (leaves ?? []).filter((l) => l.status === "Rejected").length;
  const totalDays = (leaves ?? []).reduce((s, l) => s + days(l.start_date, l.end_date), 0);

  return (
    <AppShell session={session}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Leave Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Request time off, track management decisions and view feedback.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total Requests" value={leaves?.length ?? 0} />
        <Stat label="Pending" value={pending} />
        <Stat label="Approved" value={approved} />
        <Stat label="Total Days" value={totalDays} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="New Leave Request" hint="Your manager will review and approve or reject.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Start Date
                </span>
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  End Date
                </span>
                <input
                  type="date"
                  required
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Leave Type
              </span>
              <select
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Reason / Note
              </span>
              <textarea
                rows={3}
                maxLength={500}
                placeholder="Optional details or context for the team..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              />
            </label>

            <button
              type="submit"
              disabled={create.isPending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-60"
            >
              <CalendarDays className="size-4" />
              {create.isPending ? "Submitting..." : "Submit Leave Request"}
            </button>
          </form>
        </Panel>

        <Panel title="Leave History & Decisions" hint="Live real-time status of your requests.">
          {leaves && leaves.length > 0 ? (
            <div className="space-y-3">
              {leaves.map((l) => {
                const duration = days(l.start_date, l.end_date);
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {l.start_date}
                          {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({duration} {duration === 1 ? "day" : "days"})
                        </span>
                        <span className="rounded-md border border-border bg-secondary/50 px-2 py-0.5 text-xs font-semibold text-foreground">
                          {l.leave_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {l.status === "Approved" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            Approved
                          </span>
                        ) : l.status === "Rejected" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                            <XCircle className="size-3" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="size-3" />
                            Pending Review
                          </span>
                        )}

                        {l.status === "Pending" && (
                          <button
                            onClick={() => remove.mutate(l.id)}
                            title="Cancel Request"
                            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {l.reason && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground/80 font-medium">Reason:</strong> {l.reason}
                      </p>
                    )}

                    {/* Admin Reviewer Notes & Feedback */}
                    {l.reviewer_note && (
                      <div className="mt-1 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                        <MessageSquareQuote className="size-4 shrink-0 text-primary mt-0.5" />
                        <div>
                          <p className="font-semibold text-primary">Manager Feedback:</p>
                          <p className="text-muted-foreground mt-0.5">{l.reviewer_note}</p>
                          {l.reviewed_at && (
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              Reviewed on {new Date(l.reviewed_at).toLocaleDateString()} at {new Date(l.reviewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No leave requests submitted yet.
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

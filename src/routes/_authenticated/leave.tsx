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
  Sparkles,
  Timer,
  Trash2,
  XCircle,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import {
  cancelLeave,
  getMyLeaves,
  requestLeave,
  LeaveRequest,
  LEAVE_TIME_SLOT_OPTIONS,
  formatSlotDuration,
  timeToMinutes,
} from "@/lib/leave.functions";
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

function getLeaveTypeBadge(type: string) {
  const norm = (type || "").toLowerCase();
  if (norm.includes("casual")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";
  }
  if (norm.includes("sick")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (norm.includes("emergency")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (norm.includes("permission")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400";
  }
  if (norm.includes("wfh") || norm.includes("home")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  return "border-border bg-secondary/70 text-foreground";
}

const PRESET_TIME_SLOTS = [
  { label: "09:00 AM – 11:00 AM", from: "09:00 AM", to: "11:00 AM", tag: "Morning (2h)" },
  { label: "11:00 AM – 01:00 PM", from: "11:00 AM", to: "01:00 PM", tag: "Midday (2h)" },
  { label: "02:00 PM – 04:00 PM", from: "02:00 PM", to: "04:00 PM", tag: "Afternoon (2h)" },
  { label: "04:00 PM – 06:00 PM", from: "04:00 PM", to: "06:00 PM", tag: "Late (2h)" },
  { label: "06:00 PM – 09:00 PM", from: "06:00 PM", to: "09:00 PM", tag: "Evening (3h)" },
];

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

  const [includeTimeSlot, setIncludeTimeSlot] = useState(false);
  const [fromTime, setFromTime] = useState<string>("09:00 AM");
  const [toTime, setToTime] = useState<string>("11:00 AM");

  const handleLeaveTypeChange = (newType: string) => {
    const isPermission = newType.toLowerCase().includes("permission");
    setForm((prev) => ({
      ...prev,
      leaveType: newType,
      endDate: isPermission ? prev.startDate : prev.endDate,
    }));
    if (isPermission) {
      setIncludeTimeSlot(true);
    }
  };

  const handleFromTimeChange = (newFrom: string) => {
    setFromTime(newFrom);
    const fromMin = timeToMinutes(newFrom);
    const toMin = timeToMinutes(toTime);
    if (toMin <= fromMin) {
      // Find a slot 1 hour or 30 mins ahead
      const nextSlot = LEAVE_TIME_SLOT_OPTIONS.find((t) => timeToMinutes(t) > fromMin);
      if (nextSlot) {
        const twoHoursLater = LEAVE_TIME_SLOT_OPTIONS.find((t) => timeToMinutes(t) >= fromMin + 120);
        setToTime(twoHoursLater || nextSlot);
      }
    }
  };

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const { data: leaves } = useQuery<LeaveRequest[]>({
    queryKey: ["my-leaves"],
    queryFn: () => listFn(),
    refetchInterval: 8000,
  });

  const create = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          ...form,
          ...(includeTimeSlot ? { fromTime, toTime } : {}),
        },
      }),
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

  const pending = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Pending").length;
  const approved = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Approved").length;
  const rejected = (leaves ?? []).filter((l: LeaveRequest) => l.status === "Rejected").length;
  const totalDays = (leaves ?? []).reduce((s: number, l: LeaveRequest) => s + days(l.start_date, l.end_date), 0);

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
                onChange={(e) => handleLeaveTypeChange(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary"
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            {/* Time Slot (9:00 AM – 9:00 PM) */}
            <div className="rounded-xl border border-border/80 bg-accent/20 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="size-3.5" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Time Slot (Permission)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Available timing: 9:00 AM to 9:00 PM
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeTimeSlot}
                    onChange={(e) => setIncludeTimeSlot(e.target.checked)}
                    className="size-4 rounded border-border text-primary focus:ring-primary/20 accent-primary"
                  />
                  <span className="text-xs font-medium text-foreground">
                    {includeTimeSlot ? "Enabled" : "Add Time Slot"}
                  </span>
                </label>
              </div>

              {includeTimeSlot && (
                <div className="space-y-3 pt-1 border-t border-border/50 animate-in fade-in duration-200">
                  {/* Quick Pick Presets */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1.5">
                      Quick Pick Timings (9:00 AM – 9:00 PM)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_TIME_SLOTS.map((slot) => {
                        const isSelected = fromTime === slot.from && toTime === slot.to;
                        return (
                          <button
                            type="button"
                            key={slot.label}
                            onClick={() => {
                              setFromTime(slot.from);
                              setToTime(slot.to);
                            }}
                            className={`rounded-md px-2 py-1 text-[11px] font-medium transition-all ${
                              isSelected
                                ? "bg-primary text-primary-foreground shadow-sm font-semibold"
                                : "bg-background border border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                            }`}
                          >
                            {slot.from} → {slot.to}
                            <span className="ml-1 opacity-75">({slot.tag})</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* From and To dropdowns */}
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        From Timing (Start)
                      </span>
                      <select
                        value={fromTime}
                        onChange={(e) => handleFromTimeChange(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-mono outline-none transition-colors focus:border-primary"
                      >
                        {LEAVE_TIME_SLOT_OPTIONS.slice(0, -1).map((t) => (
                          <option key={`from-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        To Timing (End)
                      </span>
                      <select
                        value={toTime}
                        onChange={(e) => setToTime(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs font-mono outline-none transition-colors focus:border-primary"
                      >
                        {LEAVE_TIME_SLOT_OPTIONS.filter(
                          (t) => timeToMinutes(t) > timeToMinutes(fromTime)
                        ).map((t) => (
                          <option key={`to-${t}`} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Duration summary chip */}
                  <div className="flex items-center justify-between rounded-lg bg-background/80 px-2.5 py-1.5 border border-border/60 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Timer className="size-3.5 text-primary" />
                      <span>Permission Duration:</span>
                    </div>
                    <span className="font-bold font-mono text-primary">
                      {formatSlotDuration(fromTime, toTime)}
                    </span>
                  </div>
                </div>
              )}
            </div>

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
              {leaves.map((l: LeaveRequest) => {
                const duration = days(l.start_date, l.end_date);
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-border"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-foreground text-sm">
                          {l.start_date}
                          {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">
                          ({duration} {duration === 1 ? "day" : "days"})
                        </span>
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getLeaveTypeBadge(
                            l.leave_type
                          )}`}
                        >
                          {l.leave_type}
                        </span>
                        {l.time_slot && (
                          <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                            <Clock className="size-3" />
                            {l.time_slot}
                          </span>
                        )}
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

                    {(l.clean_reason || l.reason) && (
                      <p className="text-xs text-muted-foreground">
                        <strong className="text-foreground/80 font-medium">Reason:</strong>{" "}
                        {l.clean_reason || l.reason}
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

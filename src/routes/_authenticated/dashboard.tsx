import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Play, Square, Trash2 } from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { WORK_STATUSES } from "@/lib/constants";
import {
  clockIn,
  clockOut,
  deleteHourlyLog,
  getMyHourlyLogs,
  getMyShifts,
  getSessionInfo,
  saveHourlyLog,
} from "@/lib/tracker.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My Shift — BI Tracker" },
      {
        name: "description",
        content:
          "Clock in and out, log project hours with start and end times, and review your shift history.",
      },
      { property: "og:title", content: "My Shift — BI Tracker" },
      {
        property: "og:description",
        content: "Track clock time and hour-by-hour project activity in BI Tracker.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const CATEGORIES = ["general", "client work", "meeting", "support", "admin", "break"];

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function hoursBetween(a: string, b: string) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function hhmm(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

function Dashboard() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const shiftsFn = useServerFn(getMyShifts);
  const logsFn = useServerFn(getMyHourlyLogs);
  const clockInFn = useServerFn(clockIn);
  const clockOutFn = useServerFn(clockOut);
  const saveLogFn = useServerFn(saveHourlyLog);
  const deleteLogFn = useServerFn(deleteHourlyLog);

  const today = todayIso();
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(new Date().getHours());
  const [task, setTask] = useState("");
  const [project, setProject] = useState("");
  const [startTime, setStartTime] = useState(hhmm(new Date().getHours()));
  const [endTime, setEndTime] = useState(hhmm((new Date().getHours() + 1) % 24));
  const [status, setStatus] = useState<string>(WORK_STATUSES[0]);
  const [category, setCategory] = useState<string>(CATEGORIES[0] ?? "general");
  const [tick, setTick] = useState(0);

  const isToday = date === today;

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const { data: shifts } = useQuery({ queryKey: ["my-shifts"], queryFn: () => shiftsFn({}) });
  const { data: logs } = useQuery({
    queryKey: ["my-logs", date],
    queryFn: () => logsFn({ data: { date } }),
  });

  const openShift = shifts?.find((s) => !s.clock_out);

  useEffect(() => {
    if (!openShift) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [openShift]);

  const clockMutation = useMutation({
    mutationFn: async (kind: "in" | "out") =>
      kind === "in" ? clockInFn({}) : clockOutFn({ data: {} }),
    onSuccess: (res) => {
      res.ok ? toast.success(res.message) : toast.error(res.message);
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
    },
    onError: () => toast.error("Could not update your shift."),
  });

  const logMutation = useMutation({
    mutationFn: () =>
      saveLogFn({
        data: { date, hour, task, category, project, startTime, endTime, status },
      }),
    onSuccess: () => {
      toast.success("Hour logged.");
      setTask("");
      qc.invalidateQueries({ queryKey: ["my-logs", date] });
    },
    onError: () => toast.error("Could not save that entry."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteLogFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-logs", date] }),
  });

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading console…
      </div>
    );
  }

  const now = new Date().toISOString();
  void tick;
  const elapsed = openShift ? hoursBetween(openShift.clock_in, now) : 0;
  const todayShifts = (shifts ?? []).filter((s) => s.clock_in.slice(0, 10) === today);
  const todayHours = todayShifts
    .filter((s) => s.clock_out)
    .reduce((sum, s) => sum + hoursBetween(s.clock_in, s.clock_out as string), 0);
  const firstCheckIn = todayShifts[todayShifts.length - 1]?.clock_in ?? null;

  // one row per date: first check-in, last check-out, total clock hours
  const shiftsByDate = new Map<
    string,
    { date: string; checkIn: string; checkOut: string | null; hours: number }
  >();
  for (const s of shifts ?? []) {
    const d = s.clock_in.slice(0, 10);
    const existing = shiftsByDate.get(d);
    const hours = s.clock_out ? hoursBetween(s.clock_in, s.clock_out) : 0;
    if (!existing) {
      shiftsByDate.set(d, {
        date: d,
        checkIn: s.clock_in,
        checkOut: s.clock_out,
        hours,
      });
    } else {
      shiftsByDate.set(d, {
        date: d,
        checkIn: s.clock_in < existing.checkIn ? s.clock_in : existing.checkIn,
        checkOut:
          !existing.checkOut || (s.clock_out && s.clock_out > existing.checkOut)
            ? s.clock_out
            : existing.checkOut,
        hours: existing.hours + hours,
      });
    }
  }
  const dayRows = [...shiftsByDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1));
  const clockHoursForDate = shiftsByDate.get(date)?.hours ?? 0;

  return (
    <AppShell session={session}>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">
            Hi {session.fullName.split(" ")[0] || "there"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.jobTitle ?? "Team member"}
            {session.department ? ` · ${session.department}` : ""}
          </p>
        </div>
        <button
          onClick={() => clockMutation.mutate(openShift ? "out" : "in")}
          disabled={clockMutation.isPending}
          className={`flex items-center gap-2 rounded-md px-5 py-3 text-sm font-semibold transition-transform hover:-translate-y-0.5 disabled:opacity-60 ${
            openShift
              ? "bg-destructive text-destructive-foreground"
              : "glow-primary bg-primary text-primary-foreground"
          }`}
        >
          {openShift ? <Square className="size-4" /> : <Play className="size-4" />}
          {openShift ? "Clock out" : "Clock in"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Current shift" value={openShift ? formatDuration(elapsed) : "—"} />
        <Stat
          label="Checked in at"
          value={firstCheckIn ? timeOnly(firstCheckIn) : "Not checked in"}
        />
        <Stat label="Today" value={todayHours.toFixed(2)} suffix="h" />
        <Stat label="Hours logged today" value={logs?.length ?? 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <Panel
          title="Log an hour"
          hint={
            isToday
              ? "Add today's project work, hour slot and status."
              : "Past days are read-only — switch to today to add entries."
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isToday) {
                toast.error("You can only log hours for today.");
                return;
              }
              if (!task.trim()) {
                toast.error("Describe the work first.");
                return;
              }
              logMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Date
                </span>
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Hour slot
                </span>
                <select
                  value={hour}
                  disabled={!isToday}
                  onChange={(e) => {
                    const h = Number(e.target.value);
                    setHour(h);
                    setStartTime(hhmm(h));
                    setEndTime(hhmm((h + 1) % 24));
                  }}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {hhmm(h)} – {hhmm((h + 1) % 24)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Project
              </span>
              <input
                value={project}
                disabled={!isToday}
                maxLength={120}
                placeholder="Project name"
                onChange={(e) => setProject(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Start time
                </span>
                <input
                  type="time"
                  value={startTime}
                  disabled={!isToday}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  End time
                </span>
                <input
                  type="time"
                  value={endTime}
                  disabled={!isToday}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Status
                </span>
                <select
                  value={status}
                  disabled={!isToday}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                >
                  {WORK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                  Category
                </span>
                <select
                  value={category}
                  disabled={!isToday}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                What did you do?
              </span>
              <textarea
                value={task}
                maxLength={400}
                rows={3}
                disabled={!isToday}
                onChange={(e) => setTask(e.target.value)}
                className="mt-1.5 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60"
              />
            </label>
            <button
              type="submit"
              disabled={logMutation.isPending || !isToday}
              className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              {isToday ? "Save hour" : "Read-only (past date)"}
            </button>
          </form>
        </Panel>

        <div className="space-y-4">
          <Panel
            title={`Hourly report · ${date}`}
            hint={`Clock time worked: ${clockHoursForDate.toFixed(2)} h · logged ${
              logs?.length ?? 0
            } h`}
          >
            {logs && logs.length > 0 ? (
              <ul className="divide-y divide-border">
                {logs.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 py-3">
                    <span className="stat-number w-24 shrink-0 text-sm text-primary">
                      {(l.start_time ?? hhmm(l.hour_slot)).slice(0, 5)}
                      {" – "}
                      {(l.end_time ?? hhmm((l.hour_slot + 1) % 24)).slice(0, 5)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{l.task}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {l.project ? `${l.project} · ` : ""}
                        <span className="uppercase tracking-widest">{l.category}</span>
                      </p>
                      {l.status && (
                        <span className="mt-1.5 inline-block rounded-md border border-border px-2 py-0.5 text-xs">
                          {l.status}
                        </span>
                      )}
                    </div>
                    {isToday && (
                      <button
                        onClick={() => deleteMutation.mutate(l.id)}
                        className="text-muted-foreground transition-colors hover:text-destructive"
                        aria-label="Delete entry"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-sm text-muted-foreground">No hours logged for this date.</p>
            )}
          </Panel>

          <Panel title="Recent shift hours" hint="One row per day — first check-in to last check-out.">
            <ul className="divide-y divide-border">
              {dayRows.slice(0, 7).map((d) => (
                <li key={d.date} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <span className="stat-number w-24 shrink-0">{d.date}</span>
                  <span className="text-muted-foreground">
                    In {timeOnly(d.checkIn)} · Out {d.checkOut ? timeOnly(d.checkOut) : "—"}
                  </span>
                  <span className="stat-number ml-auto">
                    {d.checkOut ? `${d.hours.toFixed(2)} h` : "in progress"}
                  </span>
                </li>
              ))}
              {dayRows.length === 0 && (
                <li className="py-6 text-sm text-muted-foreground">No shifts recorded yet.</li>
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function formatDuration(hours: number) {
  const total = Math.max(0, Math.floor(hours * 3600));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

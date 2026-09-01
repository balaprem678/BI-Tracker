import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Pause,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertCircle,
  Calendar,
  Layers,
  Sparkles,
  ChevronRight,
  FolderCheck,
  RotateCcw,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import {
  clockIn,
  clockOut,
  getMyShifts,
  getSessionInfo,
} from "@/lib/tracker.functions";
import {
  autoStopMidnightSessions,
  endProjectForToday,
  getMyProjects,
  getMyProjectSessions,
  pauseProjectSession,
  Project,
  ProjectSession,
  startProjectSession,
} from "@/lib/project.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Employee BI Tracker" },
      {
        name: "description",
        content:
          "Automated multi-project time tracker with real-time timers, auto-pause, and daily status logging.",
      },
      { property: "og:title", content: "Employee BI Tracker" },
      {
        property: "og:description",
        content: "Track real-time project sessions with automated timers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function todayIso() {
  const d = new Date();
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

function formatHoursDecimal(totalSeconds: number) {
  return (totalSeconds / 3600).toFixed(2);
}

function timeOnly(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function Dashboard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessionFn = useServerFn(getSessionInfo);
  const shiftsFn = useServerFn(getMyShifts);
  const clockInFn = useServerFn(clockIn);
  const clockOutFn = useServerFn(clockOut);

  // Project tracker server functions
  const myProjectsFn = useServerFn(getMyProjects);
  const mySessionsFn = useServerFn(getMyProjectSessions);
  const startSessionFn = useServerFn(startProjectSession);
  const pauseSessionFn = useServerFn(pauseProjectSession);
  const endProjectFn = useServerFn(endProjectForToday);
  const autoStopMidnightFn = useServerFn(autoStopMidnightSessions);

  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());

  // Ending project modal state
  const [endingSession, setEndingSession] = useState<{
    sessionId: string;
    projectName: string;
  } | null>(null);
  const [finalStatus, setFinalStatus] = useState("Completed");
  const [taskSummary, setTaskSummary] = useState("");

  const isToday = selectedDate === today;

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const { data: shifts } = useQuery({ queryKey: ["my-shifts"], queryFn: () => shiftsFn({}) });

  // Redirect admin to admin portal
  useEffect(() => {
    if (session?.role === "admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [session, navigate]);

  const { data: projects = [] } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => myProjectsFn({}),
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-project-sessions", selectedDate],
    queryFn: () => mySessionsFn({ data: { date: selectedDate } }),
    refetchInterval: 10000,
  });

  // Ticking timer effect (updates every 1000ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setCurrentTimestamp(now);

      // Check midnight auto-stop
      const d = new Date();
      if (d.getHours() === 23 && d.getMinutes() === 59 && d.getSeconds() >= 55) {
        autoStopMidnightFn({}).then(() => {
          qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [autoStopMidnightFn, qc]);

  // Mutations
  const clockMutation = useMutation({
    mutationFn: async (kind: "in" | "out") =>
      kind === "in" ? clockInFn({}) : clockOutFn({ data: {} }),
    onSuccess: (res) => {
      res.ok ? toast.success(res.message) : toast.error(res.message);
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
    },
    onError: () => toast.error("Could not update shift."),
  });

  const startMutation = useMutation({
    mutationFn: (p: { projectId: string; projectName: string }) =>
      startSessionFn({ data: { projectId: p.projectId, projectName: p.projectName, date: today } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to start project session."),
  });

  const pauseMutation = useMutation({
    mutationFn: (sessionId: string) => pauseSessionFn({ data: { sessionId } }),
    onSuccess: (res) => {
      toast.info(res.message);
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to pause project session."),
  });

  const endProjectMutation = useMutation({
    mutationFn: () => {
      if (!endingSession) throw new Error("No session selected");
      return endProjectFn({
        data: {
          sessionId: endingSession.sessionId,
          status: finalStatus,
          taskSummary,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setEndingSession(null);
      setTaskSummary("");
      setFinalStatus("Completed");
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to end project for today."),
  });

  // Calculate live project state
  const runningSession = useMemo(() => {
    return sessions.find((s) => !s.end_time && s.status === "In Progress" && !s.daily_ended);
  }, [sessions]);

  // Compute live duration per project
  const projectLiveState = useMemo(() => {
    const map = new Map<
      string,
      {
        session?: ProjectSession;
        isRunning: boolean;
        isDailyEnded: boolean;
        currentSeconds: number;
        status: string;
      }
    >();

    for (const p of projects) {
      const sess = sessions.find((s) => s.project_id === p.id);
      if (!sess) {
        map.set(p.id, {
          isRunning: false,
          isDailyEnded: false,
          currentSeconds: 0,
          status: "Not Started",
        });
      } else {
        let sec = sess.duration_seconds || 0;
        const isRunning = !sess.end_time && sess.status === "In Progress" && !sess.daily_ended;
        if (isRunning && isToday) {
          const startMs = new Date(sess.start_time).getTime();
          const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((currentTimestamp - startMs) / 1000));
          sec += elapsed;
        }
        map.set(p.id, {
          session: sess,
          isRunning,
          isDailyEnded: sess.daily_ended,
          currentSeconds: sec,
          status: sess.status,
        });
      }
    }
    return map;
  }, [projects, sessions, currentTimestamp, isToday]);

  // Overall statistics
  const totalSecondsToday = useMemo(() => {
    let sum = 0;
    for (const [, state] of projectLiveState.entries()) {
      sum += state.currentSeconds;
    }
    return sum;
  }, [projectLiveState]);

  const completedProjectsCount = useMemo(() => {
    return sessions.filter((s) => s.daily_ended).length;
  }, [sessions]);

  const openShift = shifts?.find((s) => !s.clock_out);

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading tracker console…
      </div>
    );
  }

  return (
    <AppShell session={session}>
      {/* Header Banner with Profile & Shift Bar */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/60 bg-gradient-to-r from-card via-card/80 to-accent/20 p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Hi {session.fullName.split(" ")[0] || "there"}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3" />
              {session.department ?? (session.role === "sub_admin" ? "Team Lead / PM" : "Employee Tracker")}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {session.jobTitle ?? "Team Member"} · Section:{" "}
            <span className="font-medium text-foreground">
              {session.role === "admin" ? "All Sections" : "Active Staff"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-xs text-muted-foreground mr-2">
            <span>Shift Status</span>
            <span className="font-semibold text-foreground">
              {openShift ? "Clocked In" : "Clocked Out"}
            </span>
          </div>
          <button
            onClick={() => clockMutation.mutate(openShift ? "out" : "in")}
            disabled={clockMutation.isPending}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 shadow-sm ${
              openShift
                ? "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "glow-primary bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            {openShift ? <Pause className="size-4" /> : <Play className="size-4" />}
            {openShift ? "Clock Out Shift" : "Clock In Shift"}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Active Project"
          value={runningSession ? runningSession.project_name : "Idle"}
          suffix={runningSession ? " (Running)" : ""}
        />
        <Stat
          label="Live Active Timer"
          value={
            runningSession
              ? formatSeconds(projectLiveState.get(runningSession.project_id)?.currentSeconds || 0)
              : "00:00:00"
          }
        />
        <Stat
          label="Total Project Hours"
          value={formatHoursDecimal(totalSecondsToday)}
          suffix="h"
        />
        <Stat
          label="Completed Today"
          value={`${completedProjectsCount} / ${projects.length}`}
        />
      </div>

      {/* Main Multi-Project Workspace */}
      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Project Workstation
            </h2>
            <p className="text-xs text-muted-foreground">
              Click Start on any project to begin tracking. Starting a new project automatically pauses any currently active project.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Date:</span>
            <input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((proj) => {
            const state = projectLiveState.get(proj.id) || {
              isRunning: false,
              isDailyEnded: false,
              currentSeconds: 0,
              status: "Not Started",
            };

            return (
              <div
                key={proj.id}
                className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all shadow-sm ${
                  state.isRunning
                    ? "border-primary/50 bg-primary/5 ring-1 ring-primary/40 shadow-md"
                    : state.isDailyEnded
                    ? "border-border/40 bg-card/60 opacity-80"
                    : "border-border/60 bg-card hover:border-border hover:shadow"
                }`}
              >
                {/* Status Badge & Code */}
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded bg-secondary/80 px-2 py-0.5 text-[11px] font-mono font-medium text-secondary-foreground">
                      {proj.code || "PROJ"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        state.isRunning
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 animate-pulse"
                          : state.isDailyEnded
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : state.status === "Paused"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          state.isRunning
                            ? "bg-emerald-500"
                            : state.isDailyEnded
                            ? "bg-blue-500"
                            : state.status === "Paused"
                            ? "bg-amber-500"
                            : "bg-muted-foreground"
                        }`}
                      />
                      {state.isRunning
                        ? "In Progress"
                        : state.isDailyEnded
                        ? `Finished (${state.status})`
                        : state.status}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-bold text-foreground line-clamp-1">
                    {proj.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                    {proj.description || "Active business intelligence track."}
                  </p>
                </div>

                {/* Timer Display */}
                <div className="my-4 rounded-lg border border-border/40 bg-background/80 p-3.5 text-center">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Today's Recorded Time
                  </span>
                  <div className="mt-0.5 text-2xl font-mono font-bold tracking-tight text-foreground">
                    {formatSeconds(state.currentSeconds)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ({formatHoursDecimal(state.currentSeconds)} hours)
                  </div>
                </div>

                {/* Action Controls */}
                <div className="pt-2">
                  {state.isDailyEnded ? (
                    <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border/40 bg-muted/40 py-2.5 text-xs font-semibold text-muted-foreground">
                      <FolderCheck className="size-4 text-emerald-500" />
                      Completed for Today
                    </div>
                  ) : !isToday ? (
                    <div className="py-2 text-center text-xs text-muted-foreground">
                      Read-only history mode
                    </div>
                  ) : state.isRunning ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => state.session && pauseMutation.mutate(state.session.id)}
                        disabled={pauseMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-600 hover:bg-amber-500/20 active:scale-[0.98] transition-all"
                      >
                        <Pause className="size-3.5" />
                        Pause
                      </button>
                      <button
                        onClick={() =>
                          state.session &&
                          setEndingSession({
                            sessionId: state.session.id,
                            projectName: proj.name,
                          })
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 active:scale-[0.98] transition-all"
                      >
                        <CheckCircle2 className="size-3.5" />
                        End for Today
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          startMutation.mutate({
                            projectId: proj.id,
                            projectName: proj.name,
                          })
                        }
                        disabled={startMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-lg glow-primary bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:brightness-110 active:scale-[0.98] transition-all shadow-sm"
                      >
                        <Play className="size-3.5" />
                        {state.status === "Paused" ? "Resume Project" : "Start Project"}
                      </button>
                      {state.session && (
                        <button
                          onClick={() =>
                            setEndingSession({
                              sessionId: state.session!.id,
                              projectName: proj.name,
                            })
                          }
                          className="flex items-center justify-center rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-all"
                          title="End for today"
                        >
                          <CheckCircle2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Sessions Breakdown Table */}
      <div className="mt-10">
        <Panel
          title="Daily Project Sessions Breakdown"
          hint={`Detailed logs for ${selectedDate}. Recorded automatically from real-time timers.`}
        >
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No project sessions recorded for {selectedDate}. Click "Start Project" above to start logging work.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="pb-3 font-semibold">Project</th>
                    <th className="pb-3 font-semibold">Start Time</th>
                    <th className="pb-3 font-semibold">End Time</th>
                    <th className="pb-3 font-semibold">Total Duration</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold">Deliverables & Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-medium">
                  {sessions.map((sess) => {
                    const isRunning = !sess.end_time && sess.status === "In Progress";
                    const liveSec = isRunning && isToday
                      ? (sess.duration_seconds || 0) +
                        Math.max(
                          0,
                          Math.floor(
                            (currentTimestamp - new Date(sess.start_time).getTime()) / 1000,
                          ),
                        )
                      : sess.duration_seconds || 0;

                    return (
                      <tr key={sess.id} className="hover:bg-accent/40 transition-colors">
                        <td className="py-3.5 font-bold text-foreground">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-primary" />
                            {sess.project_name}
                          </div>
                        </td>
                        <td className="py-3.5 font-mono text-xs text-muted-foreground">
                          {timeOnly(sess.start_time)}
                        </td>
                        <td className="py-3.5 font-mono text-xs text-muted-foreground">
                          {isRunning ? (
                            <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold animate-pulse">
                              <Clock className="size-3" /> Live
                            </span>
                          ) : (
                            timeOnly(sess.end_time)
                          )}
                        </td>
                        <td className="py-3.5 font-mono font-bold text-foreground">
                          {formatSeconds(liveSec)}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({formatHoursDecimal(liveSec)}h)
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* End Project for Today Modal Dialog */}
      {endingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  End Work for Today
                </h3>
                <p className="text-xs text-muted-foreground">
                  Project: <span className="font-semibold text-foreground">{endingSession.projectName}</span>
                </p>
              </div>
              <button
                onClick={() => setEndingSession(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Final Project Status
                </span>
                <select
                  value={finalStatus}
                  onChange={(e) => setFinalStatus(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm font-medium outline-none focus:border-primary"
                >
                  <option value="Completed">Completed (Deliverables finished)</option>
                  <option value="In Progress">In Progress (To continue next day)</option>
                  <option value="On Hold">On Hold (Awaiting review / requirements)</option>
                  <option value="Blocked">Blocked (Dependencies pending)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Work Summary & Deliverables <span className="text-destructive">*</span>
                </span>
                <textarea
                  rows={4}
                  value={taskSummary}
                  onChange={(e) => setTaskSummary(e.target.value)}
                  placeholder="Summary of what you worked on today, components built, issues resolved, or next steps..."
                  className="mt-1.5 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none focus:border-primary resize-none"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEndingSession(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={endProjectMutation.isPending || !taskSummary.trim()}
                onClick={() => endProjectMutation.mutate()}
                className="rounded-lg glow-primary bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {endProjectMutation.isPending ? "Saving…" : "Save & End for Today"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

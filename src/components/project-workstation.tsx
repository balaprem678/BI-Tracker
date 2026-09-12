import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Layers,
  Play,
  Pause,
  CheckCircle2,
  FolderCheck,
  Clock,
} from "lucide-react";
import { Panel } from "@/components/app-shell";
import { toast } from "sonner";
import {
  getMyProjects,
  getMyProjectSessions,
  startProjectSession,
  pauseProjectSession,
  endProjectForToday,
  autoStopMidnightSessions,
  ProjectSession,
} from "@/lib/project.functions";

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

function formatHoursDecimal(totalSeconds: number) {
  return (totalSeconds / 3600).toFixed(2);
}

function timeOnly(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export interface ProjectWorkstationProps {
  projects?: Array<{
    id: string;
    name: string;
    code?: string | null;
    description?: string | null;
    status?: string | null;
  }>;
  className?: string;
  defaultDate?: string;
}

export function ProjectWorkstation({
  projects: initialProjects,
  className = "",
  defaultDate,
}: ProjectWorkstationProps) {
  const qc = useQueryClient();

  const myProjectsFn = useServerFn(getMyProjects);
  const mySessionsFn = useServerFn(getMyProjectSessions);
  const startSessionFn = useServerFn(startProjectSession);
  const pauseSessionFn = useServerFn(pauseProjectSession);
  const endProjectFn = useServerFn(endProjectForToday);
  const autoStopMidnightFn = useServerFn(autoStopMidnightSessions);

  const today = todayIso(0);
  const [selectedDate, setSelectedDate] = useState(defaultDate || today);
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());

  // Ending project modal state
  const [endingSession, setEndingSession] = useState<{
    sessionId: string;
    projectName: string;
  } | null>(null);
  const [finalStatus, setFinalStatus] = useState("Completed");
  const [taskSummary, setTaskSummary] = useState("");

  const isToday = selectedDate === today;

  // If projects list not passed as prop, query my projects
  const { data: queriedProjects = [] } = useQuery({
    queryKey: ["my-projects"],
    queryFn: () => myProjectsFn({}),
    enabled: !initialProjects,
  });

  const projects = initialProjects || queriedProjects;

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
  const startMutation = useMutation({
    mutationFn: (p: { projectId: string; projectName: string }) =>
      startSessionFn({
        data: { projectId: p.projectId, projectName: p.projectName, date: today },
      }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
      qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics-today"] });
      qc.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to start project session."),
  });

  const pauseMutation = useMutation({
    mutationFn: (sessionId: string) => pauseSessionFn({ data: { sessionId } }),
    onSuccess: (res) => {
      toast.info(res.message);
      qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics-today"] });
      qc.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to pause project session."),
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
      qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
      qc.invalidateQueries({ queryKey: ["my-project-sessions", selectedDate] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics-today"] });
      qc.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
    },
    onError: (err: any) =>
      toast.error(err.message || "Failed to end project for today."),
  });

  // Compute live duration per project
  const projectLiveState = useMemo(() => {
    const map = new Map<
      string,
      {
        session?: ProjectSession | undefined;
        isRunning: boolean;
        isDailyEnded: boolean;
        currentSeconds: number;
        status: string;
      }
    >();

    for (const p of projects) {
      const userSessions = sessions.filter((s) => s.project_id === p.id);
      const active = userSessions.find(
        (s) => !s.end_time && s.status === "In Progress" && !s.daily_ended,
      );
      const isDailyEnded = userSessions.some((s) => s.daily_ended);

      let accumulated = userSessions.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0,
      );

      if (active && isToday) {
        const startMs = new Date(active.start_time).getTime();
        const liveSecs = Math.max(0, Math.floor((currentTimestamp - startMs) / 1000));
        accumulated += liveSecs;
      }

      map.set(p.id, {
        session: active || userSessions[0],
        isRunning: Boolean(active),
        isDailyEnded,
        currentSeconds: accumulated,
        status: isDailyEnded
          ? "Completed Today"
          : active
          ? "In Progress"
          : p.status || "Not Started",
      });
    }
    return map;
  }, [projects, sessions, currentTimestamp, isToday]);

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Workstation Header & Date Filter */}
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="size-5 text-primary" />
              Project Workstation
            </h2>
            <p className="text-xs text-muted-foreground">
              Click Start on any project to begin tracking. Starting a new project
              automatically pauses any currently active project.
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
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No projects currently assigned to you. Once an admin assigns you to a
            project, it will appear here.
          </div>
        ) : (
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
                          type="button"
                          onClick={() =>
                            state.session && pauseMutation.mutate(state.session.id)
                          }
                          disabled={pauseMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-600 hover:bg-amber-500/20 active:scale-[0.98] transition-all"
                        >
                          <Pause className="size-3.5" />
                          Pause
                        </button>
                        <button
                          type="button"
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
                          type="button"
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
                          {state.status === "Paused"
                            ? "Resume Project"
                            : "Start Project"}
                        </button>
                        {state.session && (
                          <button
                            type="button"
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
        )}
      </div>

      {/* Daily Sessions Breakdown Table */}
      <div>
        <Panel
          title="Daily Project Sessions Breakdown"
          hint={`Detailed logs for ${selectedDate}. Recorded automatically from real-time timers.`}
        >
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No project sessions recorded for {selectedDate}. Click "Start Project"
              above to start logging work.
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
                    const isRunning =
                      !sess.end_time && sess.status === "In Progress";
                    const liveSec =
                      isRunning && isToday
                        ? (sess.duration_seconds || 0) +
                          Math.max(
                            0,
                            Math.floor(
                              (currentTimestamp -
                                new Date(sess.start_time).getTime()) /
                                1000,
                            ),
                          )
                        : sess.duration_seconds || 0;

                    return (
                      <tr
                        key={sess.id}
                        className="hover:bg-accent/40 transition-colors"
                      >
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
                              sess.status === "Completed" ||
                              sess.status === "Completed Today"
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
                  Project:{" "}
                  <span className="font-semibold text-foreground">
                    {endingSession.projectName}
                  </span>
                </p>
              </div>
              <button
                type="button"
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
                  <option value="Completed">
                    Completed (Deliverables finished)
                  </option>
                  <option value="In Progress">
                    In Progress (To continue next day)
                  </option>
                  <option value="On Hold">
                    On Hold (Awaiting review / requirements)
                  </option>
                  <option value="Blocked">Blocked (Dependencies pending)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Work Summary & Deliverables{" "}
                  <span className="text-destructive">*</span>
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
                onClick={() => endProjectMutation.mutate()}
                disabled={endProjectMutation.isPending || !taskSummary.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {endProjectMutation.isPending ? "Saving..." : "Save & End Work"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

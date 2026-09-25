import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Play,
  Pause,
  Clock,
  Briefcase,
  Layers,
  Sparkles,
  ArrowRight,
  MapPin,
  Navigation,
  ShieldAlert,
  X,
  CalendarDays,
} from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getCurrentLocation } from "@/lib/location";
import {
  clockIn,
  clockOut,
  getMyShifts,
  getShiftAnalyticsToday,
  getSessionInfo,
} from "@/lib/tracker.functions";
import {
  autoStopMidnightSessions,
  getMyProjects,
  getMyProjectSessions,
  ProjectSession,
} from "@/lib/project.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Employee BI Tracker — Dashboard" },
      {
        name: "description",
        content:
          "Automated shift and project tracking with real-time analytics and session summaries.",
      },
      { property: "og:title", content: "Employee BI Tracker — Dashboard" },
      {
        property: "og:description",
        content: "Track real-time shifts and project session analytics.",
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
  const myProjectsFn = useServerFn(getMyProjects);
  const mySessionsFn = useServerFn(getMyProjectSessions);
  const autoStopMidnightFn = useServerFn(autoStopMidnightSessions);
  const shiftAnalyticsFn = useServerFn(getShiftAnalyticsToday);

  const today = todayIso();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentTimestamp, setCurrentTimestamp] = useState(Date.now());
  const [locationErrorModal, setLocationErrorModal] = useState<string | null>(null);
  const [isAcquiringLocation, setIsAcquiringLocation] = useState(false);
  const [endingSession, setEndingSession] = useState<ProjectSession | null>(null);
  const [finalStatus, setFinalStatus] = useState("Completed");
  const [taskSummary, setTaskSummary] = useState("");

  const isToday = selectedDate === today;

  const { data: session } = useQuery({ queryKey: ["session"], queryFn: () => sessionFn({}) });
  const { data: shifts } = useQuery({ queryKey: ["my-shifts"], queryFn: () => shiftsFn({}) });
  const { data: shiftAnalytics } = useQuery({
    queryKey: ["shift-analytics-today"],
    queryFn: () => shiftAnalyticsFn({}),
    refetchInterval: 5000,
  });

  // Redirect admin to admin portal
  useEffect(() => {
    if (session?.role !== "admin") return;
    const timer = setTimeout(() => {
      navigate({ to: "/admin", replace: true });
    }, 0);
    return () => clearTimeout(timer);
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

  // 1-second live ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Midnight check
  useEffect(() => {
    const checkMidnight = () => {
      const now = new Date();
      if (now.getHours() === 23 && now.getMinutes() === 59 && now.getSeconds() >= 55) {
        autoStopMidnightFn({}).then((res) => {
          if (res?.stoppedCount) {
            toast.info("🌙 Day ended at midnight. Active sessions have been logged.");
            qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
            qc.invalidateQueries({ queryKey: ["shift-analytics-today"] });
          }
        });
      }
    };
    const timer = window.setInterval(checkMidnight, 5000);
    return () => window.clearInterval(timer);
  }, [autoStopMidnightFn, qc]);

  const clockMutation = useMutation({
    mutationFn: (payload: {
      kind: "in" | "out";
      latitude?: number;
      longitude?: number;
      locationName?: string;
      endProjectSessionId?: string;
      projectStatus?: string;
      taskSummary?: string;
    }) => {
      if (payload.kind === "in") {
        return clockInFn({
          data: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            locationName: payload.locationName,
          },
        });
      } else {
        return clockOutFn({
          data: {
            latitude: payload.latitude,
            longitude: payload.longitude,
            locationName: payload.locationName,
            endProjectSessionId: payload.endProjectSessionId,
            projectStatus: payload.projectStatus,
            taskSummary: payload.taskSummary,
          },
        });
      }
    },
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(res.message);
        setLocationErrorModal(null);
        setEndingSession(null);
        setTaskSummary("");
        setFinalStatus("Completed");
      } else {
        toast.error(res.message);
      }
      qc.invalidateQueries({ queryKey: ["my-shifts"] });
      qc.invalidateQueries({ queryKey: ["shift-analytics-today"] });
      qc.invalidateQueries({ queryKey: ["my-project-sessions"] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      qc.invalidateQueries({ queryKey: ["admin-monitoring-overview"] });
    },
    onError: (err: any) => toast.error(err.message || "Could not update shift status."),
  });

  const triggerShiftToggle = async (
    kind: "in" | "out",
    projectDetails?: {
      endProjectSessionId?: string;
      projectStatus?: string;
      taskSummary?: string;
    },
  ) => {
    setIsAcquiringLocation(true);
    setLocationErrorModal(null);
    try {
      toast.info("Verification...");
      const loc = await getCurrentLocation();
      setIsAcquiringLocation(false);
      clockMutation.mutate({
        kind,
        latitude: loc.latitude,
        longitude: loc.longitude,
        locationName: loc.locationName,
        endProjectSessionId: projectDetails?.endProjectSessionId,
        projectStatus: projectDetails?.projectStatus,
        taskSummary: projectDetails?.taskSummary,
      });
    } catch (err: any) {
      setIsAcquiringLocation(false);
      const errMsg = err.message || "Location access failed.";
      setLocationErrorModal(errMsg);
      toast.error("Location Access Required: " + errMsg);
    }
  };

  // Calculate live project state
  const runningSession = useMemo(() => {
    return sessions.find((s) => !s.end_time && s.status === "In Progress" && !s.daily_ended);
  }, [sessions]);

  // Compute live duration across projects
  const totalSecondsToday = useMemo(() => {
    let sum = 0;
    for (const p of projects) {
      const userSessions = sessions.filter((s) => s.project_id === p.id);
      const active = userSessions.find((s) => !s.end_time && s.status === "In Progress" && !s.daily_ended);
      let accumulated = userSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0);

      if (active && isToday) {
        const startMs = new Date(active.start_time).getTime();
        const liveSecs = Math.max(0, Math.floor((currentTimestamp - startMs) / 1000));
        accumulated += liveSecs;
      }
      sum += accumulated;
    }
    return sum;
  }, [projects, sessions, currentTimestamp, isToday]);

  const activeProjectsCount = runningSession ? 1 : 0;
  const completedProjectsCount = useMemo(() => {
    return sessions.filter((s) => s.daily_ended).length;
  }, [sessions]);

  const openShift = shifts?.find((s) => !s.clock_out);
  const liveShiftSeconds = useMemo(() => {
    if (!openShift) return 0;
    const start = new Date(openShift.clock_in).getTime();
    return Math.max(0, Math.floor((currentTimestamp - start) / 1000));
  }, [openShift, currentTimestamp]);

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

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span>Shift Status:</span>
              <span className={`font-semibold ${openShift ? "text-emerald-500" : "text-amber-500"}`}>
                {openShift ? "Clocked In" : "Clocked Out"}
              </span>
            </div>
            {openShift && (
              <div className="mt-1 flex items-center gap-2 text-[11px]">
                <span className="font-mono text-foreground font-semibold">
                  Shift: {formatSeconds(liveShiftSeconds)}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (openShift) {
                if (runningSession) {
                  setEndingSession(runningSession);
                  setFinalStatus("Completed");
                  setTaskSummary("");
                  return;
                }
                triggerShiftToggle("out");
              } else {
                triggerShiftToggle("in");
              }
            }}
            disabled={isAcquiringLocation || clockMutation.isPending}
            className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 shadow-sm ${
              openShift
                ? "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "glow-primary bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            {isAcquiringLocation ? (
              <Navigation className="size-4 animate-spin" />
            ) : openShift ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4" />
            )}
            {isAcquiringLocation
              ? "Loading…"
              : openShift
                ? "Clock Out Shift"
                : "Clock In Shift"}
          </button>
        </div>
      </div>

      {/* KPI Stats Cards — Showing Counts and Hours Only */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Shift Hours (Today)"
          value={shiftAnalytics?.todayShiftHours ?? 0.0}
          suffix="h"
        />
        <Stat
          label="Project Hours (Today)"
          value={formatHoursDecimal(totalSecondsToday)}
          suffix="h"
        />
        <Stat
          label="Meetings & General"
          value={shiftAnalytics?.unallocatedHours ?? 0.0}
          suffix="h"
        />
        <Stat
          label="Active Projects"
          value={activeProjectsCount}
        />
        <Stat
          label="Completed Projects"
          value={`${completedProjectsCount} / ${projects.length}`}
        />
      </div>

      {/* Quick Link to Project Section */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Project Management & Workstation</h2>
            <p className="text-xs text-muted-foreground">
              Track multi-project timers, start/pause tasks, and log deliverables in the Project section.
            </p>
          </div>
        </div>
        <Link
          to="/project"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-primary/90"
        >
          Go to Project Workstation
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Daily Sessions Breakdown Table */}
      <div className="mt-8">
        <Panel
          title="Daily Project Sessions Breakdown"
          hint={`Detailed logs for ${selectedDate}. Recorded automatically from real-time timers.`}
          action={
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
          }
        >
          {sessions.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No project sessions recorded for {selectedDate}.
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

      {/* Modal: End Work for Today on Clock Out */}
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
                    {endingSession.project_name ||
                      projects.find((p) => p.id === endingSession.project_id)?.name ||
                      "Current Project"}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEndingSession(null)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  FINAL PROJECT STATUS
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
                  WORK SUMMARY & DELIVERABLES{" "}
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
                onClick={() => {
                  if (!taskSummary.trim()) {
                    toast.error("Please enter your work summary & deliverables before ending work.");
                    return;
                  }
                  triggerShiftToggle("out", {
                    endProjectSessionId: endingSession.id,
                    projectStatus: finalStatus,
                    taskSummary: taskSummary.trim(),
                  });
                }}
                disabled={isAcquiringLocation || clockMutation.isPending || !taskSummary.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {isAcquiringLocation
                  ? "Verifying location..."
                  : clockMutation.isPending
                  ? "Saving & Clocking Out..."
                  : "Save & End Work"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Location Permission Required Warning */}
      {locationErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Location Access Required</h3>
                  <p className="text-xs text-muted-foreground">Mandatory Geolocation Verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationErrorModal(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-xs text-foreground/90 space-y-2">
              <p className="font-semibold text-destructive">
                Location permissions must be enabled to Clock In or Clock Out.
              </p>
              <p className="text-muted-foreground">
                {locationErrorModal}
              </p>
              <div className="pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                <span className="font-semibold text-foreground">How to enable:</span> Click the lock/tune icon next to the URL bar in your browser, set <strong>Location</strong> permission to <strong>Allow</strong>, and click retry.
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocationErrorModal(null)}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => triggerShiftToggle(openShift ? "out" : "in")}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 shadow-sm"
              >
                <Navigation className="size-3.5" />
                Allow Location & Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

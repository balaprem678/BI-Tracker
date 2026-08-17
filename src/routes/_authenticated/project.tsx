import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { FolderKanban } from "lucide-react";
import { AppShell, Panel, Stat } from "@/components/app-shell";
import { getMyHourlyLogs, getSessionInfo } from "@/lib/tracker.functions";

export const Route = createFileRoute("/_authenticated/project")({
  head: () => ({
    meta: [
      { title: "Project Breakdown — BI Tracker" },
      {
        name: "description",
        content: "See how your logged hours split across projects and work categories each day.",
      },
      { property: "og:title", content: "Project Breakdown — BI Tracker" },
      {
        property: "og:description",
        content: "Daily project and category hour breakdown from your BI Tracker activity log.",
      },
    ],
  }),
  component: ProjectPage,
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function ProjectPage() {
  const sessionFn = useServerFn(getSessionInfo);
  const logsFn = useServerFn(getMyHourlyLogs);
  const [date, setDate] = useState(todayIso());

  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const logs = useQuery({
    queryKey: ["hourly-logs", date],
    queryFn: () => logsFn({ data: { date } }),
  });

  const groups = useMemo(() => {
    const map = new Map<string, { hours: number; tasks: string[] }>();
    for (const log of logs.data ?? []) {
      const entry = map.get(log.category) ?? { hours: 0, tasks: [] };
      entry.hours += 1;
      entry.tasks.push(`${String(log.hour_slot).padStart(2, "0")}:00 — ${log.task}`);
      map.set(log.category, entry);
    }
    return [...map.entries()].sort((a, b) => b[1].hours - a[1].hours);
  }, [logs.data]);

  const totalHours = groups.reduce((sum, [, g]) => sum + g.hours, 0);

  if (!session.data) return null;

  return (
    <AppShell session={session.data}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Logged hours" value={totalHours} suffix="h" />
        <Stat label="Active projects" value={groups.length} />
        <Stat
          label="Top project"
          value={groups.length ? (groups[0]?.[0] ?? "—") : "—"}
        />
      </div>

      <Panel title="Hour split by project" hint="Grouped from your hourly activity log.">
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No activity logged for this day yet. Add hourly entries from the dashboard.
          </p>
        ) : (
          <ul className="space-y-4">
            {groups.map(([category, group]) => (
              <li key={category} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium capitalize">
                    <FolderKanban className="size-4 text-primary" />
                    {category}
                  </span>
                  <span className="stat-number text-sm text-muted-foreground">
                    {group.hours}h
                  </span>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(group.hours / Math.max(totalHours, 1)) * 100}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {group.tasks.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppShell>
  );
}

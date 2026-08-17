import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, BarChart3, Lock } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BI Tracker — Employee Time Tracking & Hourly Reports" },
      {
        name: "description",
        content:
          "Track clock-ins, hour-by-hour work logs and payroll-ready reports. Employee accounts are created by admins only.",
      },
      { property: "og:title", content: "BI Tracker — Employee Time Tracking & Hourly Reports" },
      {
        property: "og:description",
        content:
          "A dark command center for shift tracking, hourly activity logs and admin-controlled accounts.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Clock,
    title: "Clock in, clock out",
    body: "One tap starts a shift. Live timer, exact timestamps, no spreadsheets.",
  },
  {
    icon: BarChart3,
    title: "Hour-by-hour logs",
    body: "Employees write what happened each hour. Every entry is timestamped and categorised.",
  },
  {
    icon: ShieldCheck,
    title: "Admin-only accounts",
    body: "There is no public sign-up. Admins create each employee login with role and hourly rate.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="grid-backdrop border-b border-border">
        <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <span className="font-display text-lg font-semibold tracking-tight">BI Tracker</span>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Sign in
          </Link>
        </header>

        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6">
          <p className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-primary">
            <Lock className="size-3.5" /> Closed workforce system
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.05] sm:text-6xl">
            Every hour of your team,
            <span className="text-primary"> accounted for.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">
            BI Tracker is an employee tracker with a dedicated admin console: shift clocking,
            hourly activity reporting and cost totals per person, per day, per week.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <Link
              to="/auth"
              className="glow-primary rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
            >
              Enter console
            </Link>
            <span className="text-sm text-muted-foreground">
              Accounts are issued by your administrator.
            </span>
          </div>
        </section>
      </div>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-16 sm:grid-cols-3 sm:px-6">
        {features.map((f) => (
          <article key={f.title} className="panel p-6">
            <span className="grid size-9 place-items-center rounded-md bg-secondary text-primary">
              <f.icon className="size-4" />
            </span>
            <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </article>
        ))}
      </section>

      <footer className="border-t border-border py-8">
        <p className="mx-auto max-w-6xl px-4 text-sm text-muted-foreground sm:px-6">
          BI Tracker · internal workforce tooling
        </p>
      </footer>
    </div>
  );
}

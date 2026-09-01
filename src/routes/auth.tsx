import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, Shield, UserCheck, User, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ADMIN_PASSWORD,
  normalizeAdminIdentifier,
} from "@/lib/bootstrap.functions";

const EMPLOYEE_EMAIL = "employee@bi-tracker.local";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Employee Sign in — BI Tracker" },
      {
        name: "description",
        content: "Sign in to BI Tracker to clock your shift and log your hourly work.",
      },
      { property: "og:title", content: "Employee Sign in — BI Tracker" },
      { property: "og:description", content: "Employee time tracking and hourly reporting." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(EMPLOYEE_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function performLogin(loginIdentifier: string, loginPass: string) {
    setBusy(true);
    try {
      const normalizedIdentifier = normalizeAdminIdentifier(loginIdentifier);
      const loginEmail = normalizedIdentifier || loginIdentifier;
      const finalPassword = loginPass || DEFAULT_ADMIN_PASSWORD;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: finalPassword,
      });

      if (error || !data.session) {
        toast.error(error?.message || "Could not sign in.");
        return;
      }

      toast.success(`Signed in as ${data.user?.user_metadata?.full_name || loginEmail}`);

      const userRole = (data.session as any)?.user?.role || "employee";
      if (userRole === "admin") {
        navigate({ to: "/admin", replace: true });
      } else if (userRole === "sub_admin") {
        navigate({ to: "/project", replace: true });
      } else {
        navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign in.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    await performLogin(identifier, password);
  }

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-8">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md bg-blue-500 text-white font-bold">
              <LayoutGrid className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold">BI Tracker</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
            <User className="size-3" />
            Employee Portal
          </span>
        </div>

        <h1 className="mt-6 text-2xl font-semibold">Employee Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in with your employee account to clock shifts and record hourly activity logs.
        </p>

        {/* 1-Click Quick Login */}
        {/* <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
            <Sparkles className="size-3.5" /> 1-Click Employee Demo Login
          </p>
          <div className="mt-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => performLogin(EMPLOYEE_EMAIL, DEFAULT_ADMIN_PASSWORD)}
              className="flex w-full items-center justify-between rounded-md border border-border bg-background p-2.5 text-left transition-colors hover:border-blue-500 hover:bg-secondary disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <span className="grid size-7 place-items-center rounded-md bg-blue-500/10 text-blue-400">
                  <User className="size-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-foreground">Alex Rivera</p>
                  <p className="text-[10px] text-muted-foreground">Software Engineer</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-xs font-medium text-blue-400">
                Login <ArrowRight className="size-3" />
              </span>
            </button>
          </div>
        </div> */}

        <form onSubmit={handleSignIn} className="mt-5 space-y-4">
          <Field
            label="Work Email"
            type="email"
            value={identifier}
            onChange={setIdentifier}
            autoComplete="email"
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-blue-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-60"
          >
            {busy ? "Signing in…" : "Sign in as Employee"}
          </button>
        </form>

        <div className="mt-4 rounded-md border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Default Employee credentials</p>
          <p className="mt-1">
            Email: <code className="text-blue-400 font-mono">{EMPLOYEE_EMAIL}</code> / Password: <code className="text-blue-400 font-mono">{DEFAULT_ADMIN_PASSWORD}</code>
          </p>
        </div>


      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        required
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-blue-500"
      />
    </label>
  );
}

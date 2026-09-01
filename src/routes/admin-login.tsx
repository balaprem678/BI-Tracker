import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { LayoutGrid, ShieldPlus, Shield, User, UserCheck, Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  createFirstAdmin,
  normalizeAdminIdentifier,
} from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/admin-login")({
  head: () => ({
    meta: [
      { title: "Admin Sign in — BI Tracker" },
      {
        name: "description",
        content: "Sign in to the BI Tracker Administrator Console.",
      },
      { property: "og:title", content: "Admin Sign in — BI Tracker" },
      { property: "og:description", content: "Administrator sign in for BI Tracker." },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(DEFAULT_ADMIN_USERNAME);
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "bootstrap">("signin");

  const bootstrapFn = useServerFn(createFirstAdmin);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
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

      const userRole = (data.session as any)?.user?.role || (loginEmail === DEFAULT_ADMIN_EMAIL ? "admin" : "employee");
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

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await bootstrapFn({ data: { email, password, fullName } });
      if (!res.ok) toast.error(res.message);
      else {
        toast.success(res.message);
        setMode("signin");
      }
    } catch {
      toast.error("Could not create the administrator account.");
    }
    setBusy(false);
  }

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4 py-8">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <LayoutGrid className="size-4" />
            </span>
            <span className="font-display text-lg font-semibold">BI Tracker</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            <Shield className="size-3" />
            Admin Portal
          </span>
        </div>

        {mode === "signin" ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Admin Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your Administrator account to access payroll and team management.
            </p>

            <form onSubmit={handleSignIn} className="mt-5 space-y-4">
              <Field
                label="Admin Username or Email"
                value={identifier}
                onChange={setIdentifier}
                autoComplete="username"
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
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Signing in…" : "Sign in as Admin"}
              </button>
            </form>

            <div className="mt-4 rounded-md border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Default Admin credentials</p>
              <p className="mt-1">
                Username: <code className="text-primary font-mono">{DEFAULT_ADMIN_USERNAME}</code> / Password: <code className="text-primary font-mono">{DEFAULT_ADMIN_PASSWORD}</code>
              </p>
            </div>



            <button
              onClick={() => setMode("bootstrap")}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-primary transition-colors hover:bg-secondary"
            >
              <ShieldPlus className="size-4" />
              Create another administrator
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">New administrator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Add an additional administrator account to your local database.
            </p>
            <form onSubmit={handleBootstrap} className="mt-6 space-y-4">
              <Field label="Full name" value={fullName} onChange={setFullName} />
              <Field
                label="Work email"
                type="email"
                value={email}
                onChange={setEmail}
                autoComplete="email"
              />
              <Field
                label="Password (min 8 characters)"
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? "Creating…" : "Create administrator"}
              </button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full text-sm text-muted-foreground hover:text-foreground"
              >
                Back to sign in
              </button>
            </form>
          </>
        )}
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
        className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
      />
    </label>
  );
}

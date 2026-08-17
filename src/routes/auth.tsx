import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Lock, LayoutGrid, ShieldPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_FULL_NAME,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  adminExists,
  createFirstAdmin,
  normalizeAdminIdentifier,
} from "@/lib/bootstrap.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — BI Tracker" },
      {
        name: "description",
        content:
          "Sign in to BI Tracker to clock your shift or open the admin console. Employee accounts are created by administrators.",
      },
      { property: "og:title", content: "Sign in — BI Tracker" },
      { property: "og:description", content: "Employee time tracking and hourly reporting." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState(DEFAULT_ADMIN_USERNAME);
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [password, setPassword] = useState(DEFAULT_ADMIN_PASSWORD);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"signin" | "bootstrap">("signin");

  const bootstrapFn = useServerFn(createFirstAdmin);
  const existsFn = useServerFn(adminExists);
  const { data: adminState } = useQuery({
    queryKey: ["admin-exists"],
    queryFn: () => existsFn({}),
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      const normalizedIdentifier = normalizeAdminIdentifier(identifier);
      const loginEmail = normalizedIdentifier || identifier;
      const loginPassword = password || DEFAULT_ADMIN_PASSWORD;

      if (normalizedIdentifier === DEFAULT_ADMIN_EMAIL) {
        const adminStateNow = await existsFn({});
        if (adminStateNow.exists === false) {
          const res = await bootstrapFn({
            data: {
              email: DEFAULT_ADMIN_EMAIL,
              password: DEFAULT_ADMIN_PASSWORD,
              fullName: DEFAULT_ADMIN_FULL_NAME,
            },
          });
          if (!res.ok) {
            toast.error(res.message);
            setBusy(false);
            return;
          }
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      navigate({
        to: normalizedIdentifier === DEFAULT_ADMIN_EMAIL ? "/admin" : "/dashboard",
        replace: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not sign in.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
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

  const canBootstrap = adminState?.exists === false;

  return (
    <div className="grid-backdrop flex min-h-screen items-center justify-center px-4">
      <div className="panel w-full max-w-md p-8">
        <div className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
            <LayoutGrid className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold">BI Tracker</span>
        </div>

        {mode === "signin" ? (
          <>
            <h1 className="mt-6 text-2xl font-semibold">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use the credentials your administrator issued.
            </p>
            <form onSubmit={handleSignIn} className="mt-6 space-y-4">
              <Field
                label="Username or work email"
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
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="mt-4 rounded-md border border-dashed border-border bg-secondary/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Default admin access</p>
              <p className="mt-1">
                Username: {DEFAULT_ADMIN_USERNAME}
              </p>
              <p>Password: {DEFAULT_ADMIN_PASSWORD}</p>
            </div>

            <p className="mt-6 flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              Employees cannot sign up. Only an administrator can create accounts from the admin
              panel.
            </p>

            {canBootstrap && (
              <button
                onClick={() => setMode("bootstrap")}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-primary transition-colors hover:bg-secondary"
              >
                <ShieldPlus className="size-4" />
                Create the first administrator
              </button>
            )}
          </>
        ) : (
          <>
            <h1 className="mt-6 text-2xl font-semibold">First administrator</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This is available only once, while no admin exists.
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

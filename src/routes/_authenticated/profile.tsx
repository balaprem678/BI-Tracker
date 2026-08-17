import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { AppShell, Panel } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Employee Profile — BI Tracker" },
      {
        name: "description",
        content: "View and edit your employee details, job title and department in BI Tracker.",
      },
      { property: "og:title", content: "Employee Profile — BI Tracker" },
      {
        property: "og:description",
        content: "Update your BI Tracker employee details and save changes instantly.",
      },
    ],
  }),
  component: ProfilePage,
});

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
    </label>
  );
}

function ProfilePage() {
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateMyProfile);

  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => profileFn() });

  const [form, setForm] = useState({ fullName: "", jobTitle: "", department: "" });

  useEffect(() => {
    if (profile.data) {
      setForm({
        fullName: profile.data.full_name,
        jobTitle: profile.data.job_title ?? "",
        department: profile.data.department ?? "",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!session.data) return null;

  return (
    <AppShell session={session.data}>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Employee details</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Editable details" hint="Update your own profile information.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Full name"
              value={form.fullName}
              onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
            />
            <Field
              label="Job title"
              value={form.jobTitle}
              placeholder="e.g. Field technician"
              onChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))}
            />
            <Field
              label="Department"
              value={form.department}
              placeholder="e.g. Operations"
              onChange={(v) => setForm((f) => ({ ...f, department: v }))}
            />
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.fullName.trim()}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="size-4" />
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </Panel>

        <Panel title="Account" hint="Managed by your administrator.">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Email</dt>
              <dd>{profile.data?.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Role</dt>
              <dd className="uppercase text-primary">{session.data.role}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Hourly rate
              </dt>
              <dd className="stat-number">{profile.data?.hourly_rate.toFixed(2) ?? "0.00"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Save,
  User,
  Briefcase,
  CalendarDays,
  DollarSign,
  PhoneCall,
  Camera,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import { getMyProfile, updateMyProfile, type MyProfile } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Employee Profile — BI Tracker" },
      {
        name: "description",
        content: "View and manage your complete employee profile in BI Tracker.",
      },
      { property: "og:title", content: "Employee Profile — BI Tracker" },
    ],
  }),
  component: ProfilePage,
});

// ---------- small reusable components ----------

function SectionCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div>
        <h2 className="font-semibold leading-tight">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      <input
        value={value}
        readOnly={readOnly}
        placeholder={readOnly ? "—" : placeholder}
        type={type}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring ${
          readOnly ? "cursor-default opacity-70 select-all bg-muted/40" : ""
        }`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
  readOnly?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        disabled={readOnly}
        onChange={readOnly ? undefined : (e) => onChange?.(e.target.value)}
        className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring ${
          readOnly ? "opacity-70 cursor-default bg-muted/40" : ""
        }`}
      >
        <option value="">— Select —</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatCard({ label, value, color = "default" }: { label: string; value: string | number; color?: "default" | "green" | "red" | "amber" }) {
  const colorMap = {
    default: "bg-muted text-foreground",
    green: "bg-emerald-500/10 text-emerald-600",
    red: "bg-red-500/10 text-red-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <div className={`rounded-lg p-4 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs opacity-75">{label}</div>
    </div>
  );
}

type Tab = "basic" | "employment" | "leave" | "salary" | "emergency";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "basic", label: "Basic Info", icon: <User className="size-4" /> },
  { id: "employment", label: "Employment", icon: <Briefcase className="size-4" /> },
  { id: "leave", label: "Leave & Attendance", icon: <CalendarDays className="size-4" /> },
  { id: "salary", label: "Salary / HR", icon: <DollarSign className="size-4" /> },
  { id: "emergency", label: "Emergency Contact", icon: <PhoneCall className="size-4" /> },
];

function initForm(p: MyProfile | null | undefined) {
  return {
    fullName: p?.full_name ?? "",
    gender: p?.gender ?? "",
    dateOfBirth: p?.date_of_birth ?? "",
    mobile: p?.mobile ?? "",
    address: p?.address ?? "",
    city: p?.city ?? "",
    state: p?.state ?? "",
    pincode: p?.pincode ?? "",
    photoUrl: p?.photo_url ?? "",
    jobTitle: p?.job_title ?? "",
    department: p?.department ?? "",
    jobType: p?.job_type ?? "",
    joiningDate: p?.joining_date ?? "",
    workLocation: p?.work_location ?? "",
    salary: p?.salary != null ? String(p.salary) : "",
    salaryType: p?.salary_type ?? "",
    bankAccount: p?.bank_account ?? "",
    pan: p?.pan ?? "",
    uan: p?.uan ?? "",
    pfNumber: p?.pf_number ?? "",
    experience: p?.experience ?? "",
    previousCompany: p?.previous_company ?? "",
    emergencyContactName: p?.emergency_contact_name ?? "",
    emergencyContactRelation: p?.emergency_contact_relation ?? "",
    emergencyContactPhone: p?.emergency_contact_phone ?? "",
    emergencyContactAddress: p?.emergency_contact_address ?? "",
  };
}

// ---------- Profile page ----------

function ProfilePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const sessionFn = useServerFn(getSessionInfo);
  const profileFn = useServerFn(getMyProfile);
  const saveFn = useServerFn(updateMyProfile);

  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const isEmployee = session.data?.role === "employee";
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => profileFn(),
    enabled: isEmployee,
  });

  // Redirect admins and sub-admins away from employee profile
  useEffect(() => {
    if (!session.data) return;
    if (session.data.role === "admin") {
      navigate({ to: "/admin", replace: true });
    } else if (session.data.role === "sub_admin") {
      navigate({ to: "/project", replace: true });
    }
  }, [session.data, navigate]);

  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [form, setForm] = useState(initForm(null));
  const [showSalary, setShowSalary] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile.data) {
      setForm(initForm(profile.data));
      setPhotoPreview(profile.data.photo_url || null);
    }
  }, [profile.data]);

  const set = (key: keyof ReturnType<typeof initForm>) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isEmployee) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview(dataUrl);
      setForm((f) => ({ ...f, photoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...form,
          salary: form.salary ? Number(form.salary) : null,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved successfully");
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!session.data) return null;

  // Admins do not have or need an employee profile
  if (session.data.role !== "employee") {
    return (
      <AppShell session={session.data}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-full bg-primary/10 p-4 text-primary">
            <ShieldAlert className="size-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Admin Account</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Administrators do not require an employee profile. Redirecting to the Admin Panel…
          </p>
        </div>
      </AppShell>
    );
  }

  const profileData = profile.data;
  const employeeId = profileData?.id?.slice(-8).toUpperCase() ?? "—";

  // Derived leave/attendance stats from profile created_at date
  const joiningDate = profileData?.joining_date
    ? new Date(profileData.joining_date)
    : profileData?.created_at
      ? new Date(profileData.created_at)
      : null;
  const daysWorked = joiningDate
    ? Math.max(0, Math.floor((Date.now() - joiningDate.getTime()) / 86400000))
    : 0;

  return (
    <AppShell session={session.data}>
      <div className="mx-auto max-w-5xl">
        {/* Employee Read-Only Banner */}
        {isEmployee && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>Profile Edit Locked:</strong> Profile details are managed by Administrators. Please contact an administrator to request updates to your account details.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`flex size-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted shadow-md ${
                  isEmployee ? "cursor-default" : "cursor-pointer"
                }`}
                onClick={isEmployee ? undefined : () => fileRef.current?.click()}
                title={isEmployee ? "Profile picture" : "Click to change photo"}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="size-full object-cover" />
                ) : (
                  <User className="size-9 text-muted-foreground" />
                )}
              </div>
              {!isEmployee && (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-border bg-background shadow hover:bg-muted"
                  title="Upload photo"
                >
                  <Camera className="size-3" />
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
                disabled={isEmployee}
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {form.fullName || "Your Profile"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary uppercase">
                  {session.data.role.replace("_", " ")}
                </span>
                <span>·</span>
                <span>ID: #{employeeId}</span>
                {form.department && (
                  <>
                    <span>·</span>
                    <span>{form.department}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isEmployee && (
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.fullName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {save.isPending ? "Saving…" : "Save Changes"}
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 min-w-max items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "basic" && (
          <SectionCard>
            <SectionTitle
              icon={<User className="size-4" />}
              title="Basic Information"
              hint="Your personal details visible to administrators."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Employee ID" value={`#${employeeId}`} readOnly />
              <Field
                label="Full Name"
                value={form.fullName}
                onChange={set("fullName")}
                required
                readOnly={isEmployee}
                placeholder="e.g. Alex Rivera"
              />
              <SelectField
                label="Gender"
                value={form.gender}
                onChange={set("gender")}
                readOnly={isEmployee}
                options={[
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                  { value: "other", label: "Other" },
                  { value: "prefer_not", label: "Prefer not to say" },
                ]}
              />
              <Field
                label="Date of Birth"
                value={form.dateOfBirth}
                onChange={set("dateOfBirth")}
                type="date"
                readOnly={isEmployee}
              />
              <Field
                label="Mobile Number"
                value={form.mobile}
                onChange={set("mobile")}
                readOnly={isEmployee}
                placeholder="+91 98765 43210"
              />
              <Field
                label="Email Address"
                value={profileData?.email ?? ""}
                readOnly
              />
              <div className="sm:col-span-2">
                <Field
                  label="Address"
                  value={form.address}
                  onChange={set("address")}
                  readOnly={isEmployee}
                  placeholder="Street address"
                />
              </div>
              <Field
                label="City"
                value={form.city}
                onChange={set("city")}
                readOnly={isEmployee}
                placeholder="e.g. Mumbai"
              />
              <Field
                label="State"
                value={form.state}
                onChange={set("state")}
                readOnly={isEmployee}
                placeholder="e.g. Maharashtra"
              />
              <Field
                label="Pincode"
                value={form.pincode}
                onChange={set("pincode")}
                readOnly={isEmployee}
                placeholder="e.g. 400001"
              />
            </div>
          </SectionCard>
        )}

        {activeTab === "employment" && (
          <SectionCard>
            <SectionTitle
              icon={<Briefcase className="size-4" />}
              title="Employment Information"
              hint="Your role, type of work, and joining details."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Designation / Job Title"
                value={form.jobTitle}
                onChange={set("jobTitle")}
                readOnly={isEmployee}
                placeholder="e.g. Senior Analyst"
              />
              <Field
                label="Department"
                value={form.department}
                onChange={set("department")}
                readOnly={isEmployee}
                placeholder="e.g. Business Intelligence"
              />
              <SelectField
                label="Job Type"
                value={form.jobType}
                onChange={set("jobType")}
                readOnly={isEmployee}
                options={[
                  { value: "full-time", label: "Full-time" },
                  { value: "part-time", label: "Part-time" },
                  { value: "contract", label: "Contract" },
                  { value: "intern", label: "Intern" },
                ]}
              />
              <Field
                label="Joining Date"
                value={form.joiningDate}
                onChange={set("joiningDate")}
                type="date"
                readOnly={isEmployee}
              />
              <Field
                label="Work Location"
                value={form.workLocation}
                onChange={set("workLocation")}
                readOnly={isEmployee}
                placeholder="e.g. Bangalore / Remote"
              />
            </div>
          </SectionCard>
        )}

        {activeTab === "leave" && (
          <div className="space-y-5">
            <SectionCard>
              <SectionTitle
                icon={<CalendarDays className="size-4" />}
                title="Attendance Overview"
                hint="Derived from your shift records."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Days Since Joining" value={daysWorked} color="default" />
                <StatCard label="Present Days" value={daysWorked} color="green" />
                <StatCard label="Absent Days" value={0} color="red" />
                <StatCard label="Late Days" value={0} color="amber" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Work From Home" value={0} color="default" />
                <StatCard label="Casual Leave" value="N/A" />
                <StatCard label="Sick Leave" value="N/A" />
                <StatCard label="Earned Leave" value="N/A" />
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle
                icon={<CalendarDays className="size-4" />}
                title="Leave History"
                hint="All leave requests submitted by you."
              />
              <p className="text-sm text-muted-foreground">
                View and manage your leave requests on the{" "}
                <a href="/leave" className="text-primary underline underline-offset-2">
                  Leave page
                </a>
                .
              </p>
            </SectionCard>
          </div>
        )}

        {activeTab === "salary" && (
          <SectionCard>
            <div className="mb-5 flex items-start justify-between gap-3">
              <SectionTitle
                icon={<DollarSign className="size-4" />}
                title="Salary / HR Information"
                hint={
                  isEmployee
                    ? "Your payroll and banking details — read-only for employees."
                    : "Payroll, banking, and compliance details."
                }
              />
              <button
                onClick={() => setShowSalary((s) => !s)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                {showSalary ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                {showSalary ? "Hide" : "Reveal"}
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Salary"
                value={showSalary ? form.salary : form.salary ? "●●●●●" : ""}
                onChange={set("salary")}
                placeholder="e.g. 50000"
                type={showSalary ? "number" : "text"}
                readOnly={isEmployee}
              />
              <SelectField
                label="Salary Type"
                value={form.salaryType}
                onChange={set("salaryType")}
                readOnly={isEmployee}
                options={[
                  { value: "monthly", label: "Monthly" },
                  { value: "weekly", label: "Weekly" },
                  { value: "daily", label: "Daily" },
                  { value: "hourly", label: "Hourly" },
                ]}
              />
              <Field
                label="Bank Account Number"
                value={showSalary ? form.bankAccount : form.bankAccount ? "●●●● ●●●● " + form.bankAccount.slice(-4) : ""}
                onChange={set("bankAccount")}
                placeholder="Account number"
                readOnly={isEmployee}
              />
              <Field
                label="PAN Number"
                value={showSalary ? form.pan : form.pan ? form.pan.slice(0, 2) + "●●●●●●●" + form.pan.slice(-1) : ""}
                onChange={set("pan")}
                placeholder="ABCDE1234F"
                readOnly={isEmployee}
              />
              <Field
                label="UAN"
                value={showSalary ? form.uan : form.uan ? "●●●●●●●" + form.uan.slice(-3) : ""}
                onChange={set("uan")}
                placeholder="Universal Account Number"
                readOnly={isEmployee}
              />
              <Field
                label="PF Number"
                value={showSalary ? form.pfNumber : form.pfNumber ? "●●●●●●●" + form.pfNumber.slice(-3) : ""}
                onChange={set("pfNumber")}
                placeholder="PF account number"
                readOnly={isEmployee}
              />
              {/* <Field
                label="Experience"
                value={form.experience}
                onChange={set("experience")}
                placeholder="e.g. 3 years"
              />
              <Field
                label="Previous Company"
                value={form.previousCompany}
                onChange={set("previousCompany")}
                placeholder="e.g. Acme Corp"
              /> */}
            </div>
          </SectionCard>
        )}

        {activeTab === "emergency" && (
          <SectionCard>
            <SectionTitle
              icon={<PhoneCall className="size-4" />}
              title="Emergency Contact"
              hint="Person to contact in case of emergency."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Contact Person"
                value={form.emergencyContactName}
                onChange={set("emergencyContactName")}
                readOnly={isEmployee}
                placeholder="e.g. John Rivera"
              />
              <Field
                label="Relationship"
                value={form.emergencyContactRelation}
                onChange={set("emergencyContactRelation")}
                readOnly={isEmployee}
                placeholder="e.g. Father, Spouse"
              />
              <Field
                label="Phone Number"
                value={form.emergencyContactPhone}
                onChange={set("emergencyContactPhone")}
                readOnly={isEmployee}
                placeholder="+91 98765 43210"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Address"
                  value={form.emergencyContactAddress}
                  onChange={set("emergencyContactAddress")}
                  readOnly={isEmployee}
                  placeholder="Emergency contact address"
                />
              </div>
            </div>
          </SectionCard>
        )}

        {/* Bottom save bar */}
        <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {profile.isLoading ? "Loading profile…" : `Last updated: ${profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : "—"}`}
          </p>
          {/* <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.fullName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="size-4" />
            {save.isPending ? "Saving…" : "Save Changes"}
          </button> */}
        </div>
      </div>
    </AppShell>
  );
}

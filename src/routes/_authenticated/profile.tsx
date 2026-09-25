import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
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
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquareQuote,
  ArrowRight,
  Download,
  Printer,
  Building2,
  CreditCard,
  Lock,
  FileText,
  Sparkles,
  Calculator,
  ChevronRight,
  Receipt,
  Calendar,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getSessionInfo, getMyShifts, type Shift } from "@/lib/tracker.functions";
import { getMyProfile, updateMyProfile, type MyProfile } from "@/lib/profile.functions";
import { getMyLeaves, type LeaveRequest } from "@/lib/leave.functions";
import {
  getMySalaryOverview,
  getMyPayslips,
  type Payslip,
} from "@/lib/salary.functions";
import { PayslipViewModal } from "@/components/payslip-view";
import { LEAVE_TYPES } from "@/lib/constants";

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

// ---------- small reusable components & helpers ----------

function calculateDays(start: string, end: string) {
  if (!start || !end) return 1;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

function getLeaveTypeBadge(type: string) {
  const norm = (type || "").toLowerCase();
  if (norm.includes("casual")) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400";
  }
  if (norm.includes("sick")) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
  }
  if (norm.includes("emergency")) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }
  if (norm.includes("permission")) {
    return "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400";
  }
  if (norm.includes("wfh") || norm.includes("home")) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  return "border-border bg-secondary/70 text-foreground";
}

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

function StatCard({
  label,
  value,
  color = "default",
  subtext,
}: {
  label: string;
  value: string | number;
  color?: "default" | "green" | "red" | "amber";
  subtext?: string | undefined;
}) {
  const colorMap = {
    default: "bg-muted text-foreground",
    green: "bg-emerald-500/10 text-emerald-600",
    red: "bg-red-500/10 text-red-600",
    amber: "bg-amber-500/10 text-amber-600",
  };
  return (
    <div className={`rounded-lg p-4 text-center ${colorMap[color]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-1 text-xs opacity-75 font-medium truncate">{label}</div>
      {subtext && <div className="mt-0.5 text-[10px] font-semibold opacity-70 truncate">{subtext}</div>}
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
    employeeId: p?.employee_id ?? "",
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
    bankName: p?.bank_name ?? "",
    bankAccount: p?.bank_account ?? "",
    bankIfsc: p?.bank_ifsc ?? "",
    pan: p?.pan ?? "",
    uan: p?.uan ?? "",
    lop: p?.lop ?? "",
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

  const leavesFn = useServerFn(getMyLeaves);
  const shiftsFn = useServerFn(getMyShifts);

  const leavesQuery = useQuery<LeaveRequest[]>({
    queryKey: ["my-leaves"],
    queryFn: () => leavesFn(),
    enabled: isEmployee,
    refetchInterval: 8000,
  });

  const shiftsQuery = useQuery<Shift[]>({
    queryKey: ["my-shifts"],
    queryFn: () => shiftsFn(),
    enabled: isEmployee,
    refetchInterval: 10000,
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

  // Salary & Payslip states
  const salaryOverviewFn = useServerFn(getMySalaryOverview);
  const payslipsFn = useServerFn(getMyPayslips);

  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  });

  const [selectedPayslipModal, setSelectedPayslipModal] = useState<Payslip | null>(null);
  const [isPayslipOpen, setIsPayslipOpen] = useState(false);

  const salaryOverviewQuery = useQuery({
    queryKey: ["my-salary-overview", selectedSalaryMonth],
    queryFn: () => salaryOverviewFn({ data: { month_year: selectedSalaryMonth } }),
    enabled: isEmployee,
  });

  const payslipsQuery = useQuery<Payslip[]>({
    queryKey: ["my-payslips"],
    queryFn: () => payslipsFn(),
    enabled: isEmployee,
  });

  const monthOptions = useMemo(() => {
    const options = [];
    const curr = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(curr.getFullYear(), curr.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      options.push({ value, label });
    }
    return options;
  }, []);

  const formatINR = (val: number | undefined | null) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  useEffect(() => {
    if (profile.data) {
      setForm(initForm(profile.data));
      setPhotoPreview(profile.data.photo_url || null);
    }
  }, [profile.data]);

  const set = (key: keyof ReturnType<typeof initForm>) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

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

  const profileData = profile.data;
  const employeeId = profileData?.employee_id || profileData?.id?.slice(-8).toUpperCase() || "—";

  // Derived leave/attendance stats from profile created_at date
  const joiningDate = profileData?.joining_date
    ? new Date(profileData.joining_date)
    : profileData?.created_at
      ? new Date(profileData.created_at)
      : null;
  const daysWorked = joiningDate
    ? Math.max(0, Math.floor((Date.now() - joiningDate.getTime()) / 86400000))
    : 0;

  const myLeaves = useMemo(() => leavesQuery.data ?? [], [leavesQuery.data]);
  const myShifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data]);

  // Unique calendar days on which employee clocked in
  const uniqueShiftDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of myShifts) {
      if (s.clock_in) {
        set.add(s.clock_in.slice(0, 10));
      }
    }
    return set.size;
  }, [myShifts]);

  // Present Days: actual unique clocked-in days
  const presentDays = uniqueShiftDays > 0 ? uniqueShiftDays : (myShifts.length > 0 ? myShifts.length : (daysWorked > 0 ? daysWorked : 0));

  // Approved leave days
  const approvedLeaves = useMemo(() => {
    return myLeaves.filter((l) => l.status === "Approved");
  }, [myLeaves]);

  const totalApprovedLeaveDays = useMemo(() => {
    return approvedLeaves.reduce((sum, l) => sum + calculateDays(l.start_date, l.end_date), 0);
  }, [approvedLeaves]);

  // Absent days: days elapsed minus present days minus approved leaves
  const absentDays = Math.max(0, daysWorked - presentDays - totalApprovedLeaveDays);

  // Late days: shifts where clock_in hour > 10 AM
  const lateDays = useMemo(() => {
    let count = 0;
    for (const s of myShifts) {
      if (s.clock_in) {
        const d = new Date(s.clock_in);
        if (d.getHours() > 10 || (d.getHours() === 10 && d.getMinutes() > 0)) {
          count++;
        }
      }
    }
    return count;
  }, [myShifts]);

  // Breakdown by leave type
  const leaveStatsByType = useMemo(() => {
    const map: Record<string, { approvedDays: number; pendingDays: number; totalDays: number; count: number }> = {};
    for (const type of LEAVE_TYPES) {
      map[type] = { approvedDays: 0, pendingDays: 0, totalDays: 0, count: 0 };
    }

    for (const l of myLeaves) {
      const lDays = calculateDays(l.start_date, l.end_date);
      const lType = l.leave_type || "";
      const norm = lType.toLowerCase();

      let matchedKey = LEAVE_TYPES.find((t) => {
        const tNorm = t.toLowerCase();
        if (tNorm === "casual leave") return norm.includes("casual");
        if (tNorm === "sick") return norm.includes("sick");
        if (tNorm === "emergency") return norm.includes("emergency");
        if (tNorm === "permission") return norm.includes("permission");
        if (tNorm === "wfh") return norm.includes("wfh") || norm.includes("home");
        return tNorm === norm;
      }) || "Others";

      if (!map[matchedKey]) {
        map[matchedKey] = { approvedDays: 0, pendingDays: 0, totalDays: 0, count: 0 };
      }

      map[matchedKey].count += 1;
      map[matchedKey].totalDays += lDays;
      if (l.status === "Approved") {
        map[matchedKey].approvedDays += lDays;
      } else if (l.status === "Pending") {
        map[matchedKey].pendingDays += lDays;
      }
    }
    return map;
  }, [myLeaves]);

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

  return (
    <AppShell session={session.data}>
      <div className="mx-auto max-w-5xl">
        {/* Employee Read-Only Banner */}
        {isEmployee && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
            <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Profile details are managed by Administrators. Please contact an administrator to request updates to your account details.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Avatar (Read-only, Admin Managed) */}
            <div className="relative shrink-0">
              <div
                className="flex size-20 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted shadow-md cursor-default"
                title="Profile picture (managed by administrator)"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="size-full object-cover" />
                ) : (
                  <User className="size-9 text-muted-foreground" />
                )}
              </div>
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
                <span>ID: {employeeId}</span>
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
              <Field label="Employee ID" value={employeeId} readOnly />
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
                hint="Derived from your shift records and leave approvals."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Days Since Joining" value={daysWorked} color="default" />
                <StatCard label="Present Days" value={presentDays} color="green" />
                <StatCard label="Absent Days" value={absentDays} color="red" />
                <StatCard label="Late Days" value={lateDays} color="amber" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {LEAVE_TYPES.map((type) => {
                  const stats = leaveStatsByType[type] || { approvedDays: 0, pendingDays: 0, totalDays: 0, count: 0 };
                  const value = stats.approvedDays > 0 ? stats.approvedDays : stats.pendingDays > 0 ? stats.pendingDays : 0;
                  const subtext =
                    stats.pendingDays > 0
                      ? `${stats.pendingDays} pending`
                      : stats.approvedDays > 0
                        ? `${stats.approvedDays} approved`
                        : undefined;

                  return (
                    <StatCard
                      key={type}
                      label={type}
                      value={value}
                      subtext={subtext}
                      color={stats.approvedDays > 0 ? "green" : stats.pendingDays > 0 ? "amber" : "default"}
                    />
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <SectionTitle
                  icon={<CalendarDays className="size-4" />}
                  title="Leave History & Decisions"
                  hint="All leave requests submitted by you and their live real-time status."
                />
                <a
                  href="/leave"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                >
                  <span>Apply for Leave</span>
                  <ArrowRight className="size-3.5" />
                </a>
              </div>

              {leavesQuery.isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading leave records…
                </div>
              ) : myLeaves.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                  <CalendarDays className="mx-auto size-7 text-muted-foreground/60" />
                  <p className="font-semibold text-foreground">No leave requests submitted yet.</p>
                  <p>When you submit a leave request, its status and details will update here in real-time.</p>
                  <a
                    href="/leave"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline mt-1"
                  >
                    Go to Leave Page →
                  </a>
                </div>
              ) : (
                <div className="space-y-3">
                  {myLeaves.map((l) => {
                    const duration = calculateDays(l.start_date, l.end_date);
                    return (
                      <div
                        key={l.id}
                        className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/60 p-4 transition-all hover:border-border"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground text-sm">
                              {l.start_date}
                              {l.end_date !== l.start_date ? ` → ${l.end_date}` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              ({duration} {duration === 1 ? "day" : "days"})
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getLeaveTypeBadge(
                                l.leave_type
                              )}`}
                            >
                              {l.leave_type}
                            </span>
                            {l.time_slot && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                                <Clock className="size-3" />
                                {l.time_slot}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {l.status === "Approved" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3" />
                                Approved
                              </span>
                            ) : l.status === "Rejected" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                                <XCircle className="size-3" />
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                                <Clock className="size-3" />
                                Pending Review
                              </span>
                            )}
                          </div>
                        </div>

                        {(l.clean_reason || l.reason) && (
                          <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground/80 font-medium">Reason:</strong>{" "}
                            {l.clean_reason || l.reason}
                          </p>
                        )}

                        {/* Manager Feedback */}
                        {l.reviewer_note && (
                          <div className="mt-1 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                            <MessageSquareQuote className="size-4 shrink-0 text-primary mt-0.5" />
                            <div>
                              <p className="font-semibold text-primary">Manager Feedback:</p>
                              <p className="text-muted-foreground mt-0.5">{l.reviewer_note}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>
        )}

        {activeTab === "salary" && (
          <div className="space-y-6">
            {/* Filter and Top Status Card */}
            <SectionCard>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <DollarSign className="size-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Monthly Salary & Compensation</h2>
                    <p className="text-xs text-muted-foreground">
                      Calculated monthly payout after LOP, PF, Professional Tax, and other deductions.
                    </p>
                  </div>
                </div>

                {/* Month Filter and Reveal Controls */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="flex items-center gap-1.5 bg-muted/50 border border-border/80 px-2.5 py-1.5 rounded-lg text-xs">
                    <Calendar className="size-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground font-medium">Payroll Month:</span>
                    <select
                      value={selectedSalaryMonth}
                      onChange={(e) => setSelectedSalaryMonth(e.target.value)}
                      className="bg-transparent text-foreground font-semibold outline-none cursor-pointer"
                    >
                      {monthOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-popover text-popover-foreground">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setShowSalary((s) => !s)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {showSalary ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    {showSalary ? "Hide Numbers" : "Reveal Numbers"}
                  </button>
                </div>
              </div>

              {/* Monthly KPI Overview Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
                {/* Gross Pay */}
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Monthly Gross Pay</span>
                    <Building2 className="size-4 text-muted-foreground/70" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-foreground mt-2">
                    {showSalary
                      ? formatINR(salaryOverviewQuery.data?.calculated?.gross_earnings ?? salaryOverviewQuery.data?.structure?.monthly_gross ?? 0)
                      : "●●●●●"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Basic + HRA + Allowances
                  </div>
                </div>

                {/* Total Deductions with breakdown chips */}
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
                  <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <span>Total Deductions</span>
                    <Calculator className="size-4" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-2">
                    {showSalary
                      ? formatINR(salaryOverviewQuery.data?.calculated?.total_deductions ?? 0)
                      : "●●●●●"}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                    <span className="bg-rose-500/10 text-rose-700 dark:text-rose-300 px-1.5 py-0.5 rounded">
                      LOP: {salaryOverviewQuery.data?.calculated?.lop_days ?? 0}d
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      PF: {showSalary ? formatINR(salaryOverviewQuery.data?.calculated?.pf_deduction ?? 0) : "••"}
                    </span>
                    <span className="bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      PT: {showSalary ? formatINR(salaryOverviewQuery.data?.calculated?.pt_deduction ?? 0) : "••"}
                    </span>
                  </div>
                </div>

                {/* Net Take-Home Salary */}
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between text-xs text-primary font-semibold">
                    <span>Net Salary Payable</span>
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div className="text-2xl font-black font-mono text-primary mt-2">
                    {showSalary
                      ? formatINR(salaryOverviewQuery.data?.calculated?.net_salary ?? 0)
                      : "●●●●●"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Direct Credit to Bank
                  </div>
                </div>

                {/* Attendance & Days Summary */}
                <div className="p-4 rounded-xl border border-border/60 bg-muted/20">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Attendance & LOP</span>
                    <Clock className="size-4 text-muted-foreground/70" />
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-2xl font-bold text-foreground">
                      {salaryOverviewQuery.data?.calculated?.paid_days ?? 0}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      / {salaryOverviewQuery.data?.calculated?.total_days ?? 30} Paid Days
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {salaryOverviewQuery.data?.calculated?.lop_days ?? 0} LOP Loss of Pay Days
                  </div>
                </div>
              </div>

              {/* Comprehensive Breakdown Tables */}
              <div className="mt-6 border border-border/80 rounded-xl overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/80">
                  {/* Earnings column */}
                  <div className="flex flex-col">
                    <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-3.5 font-semibold text-xs text-emerald-700 dark:text-emerald-300 flex justify-between uppercase tracking-wider">
                      <span>Monthly Earnings</span>
                      <span>Amount</span>
                    </div>
                    <div className="p-4 space-y-3 text-xs flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Basic Pay</span>
                        <span className="font-mono font-medium">
                          {showSalary
                            ? formatINR(salaryOverviewQuery.data?.calculated?.basic_pay ?? salaryOverviewQuery.data?.structure?.basic_pay ?? 0)
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">House Rent Allowance (HRA)</span>
                        <span className="font-mono font-medium">
                          {showSalary
                            ? formatINR(salaryOverviewQuery.data?.calculated?.hra ?? salaryOverviewQuery.data?.structure?.hra ?? 0)
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Special Allowance</span>
                        <span className="font-mono font-medium">
                          {showSalary
                            ? formatINR(salaryOverviewQuery.data?.calculated?.special_allowance ?? salaryOverviewQuery.data?.structure?.special_allowance ?? 0)
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Conveyance Allowance</span>
                        <span className="font-mono font-medium">
                          {showSalary
                            ? formatINR(salaryOverviewQuery.data?.calculated?.conveyance ?? salaryOverviewQuery.data?.structure?.conveyance ?? 0)
                            : "●●●●●"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-muted/40 border-t border-border/60 flex justify-between font-semibold text-xs">
                      <span>Gross Earnings</span>
                      <span className="font-mono text-foreground">
                        {showSalary
                          ? formatINR(salaryOverviewQuery.data?.calculated?.gross_earnings ?? salaryOverviewQuery.data?.structure?.monthly_gross ?? 0)
                          : "●●●●●"}
                      </span>
                    </div>
                  </div>

                  {/* Deductions column */}
                  <div className="flex flex-col">
                    <div className="bg-rose-500/10 dark:bg-rose-500/15 p-3.5 font-semibold text-xs text-rose-700 dark:text-rose-300 flex justify-between uppercase tracking-wider">
                      <span>Monthly Deductions</span>
                      <span>Amount</span>
                    </div>
                    <div className="p-4 space-y-3 text-xs flex-1">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          Loss of Pay (LOP)
                          {(salaryOverviewQuery.data?.calculated?.lop_days ?? 0) > 0 && (
                            <span className="text-[10px] bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold px-1.5 py-0.5 rounded">
                              {salaryOverviewQuery.data?.calculated?.lop_days} days unpaid
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-medium text-rose-600 dark:text-rose-400">
                          {showSalary
                            ? `- ${formatINR(salaryOverviewQuery.data?.calculated?.lop_deduction ?? 0)}`
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Provident Fund (Employee PF)</span>
                        <span className="font-mono font-medium text-rose-600/90 dark:text-rose-400/90">
                          {showSalary
                            ? `- ${formatINR(salaryOverviewQuery.data?.calculated?.pf_deduction ?? salaryOverviewQuery.data?.structure?.pf_deduction ?? 0)}`
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Professional Tax (PT)</span>
                        <span className="font-mono font-medium text-rose-600/90 dark:text-rose-400/90">
                          {showSalary
                            ? `- ${formatINR(salaryOverviewQuery.data?.calculated?.pt_deduction ?? salaryOverviewQuery.data?.structure?.pt_deduction ?? 0)}`
                            : "●●●●●"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Tax Deducted at Source (TDS)</span>
                        <span className="font-mono font-medium text-rose-600/90 dark:text-rose-400/90">
                          {showSalary
                            ? `- ${formatINR(salaryOverviewQuery.data?.calculated?.tds_deduction ?? salaryOverviewQuery.data?.structure?.tds_deduction ?? 0)}`
                            : "●●●●●"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3.5 bg-muted/40 border-t border-border/60 flex justify-between font-semibold text-xs">
                      <span>Total Deductions</span>
                      <span className="font-mono text-rose-600 dark:text-rose-400">
                        {showSalary
                          ? `- ${formatINR(salaryOverviewQuery.data?.calculated?.total_deductions ?? 0)}`
                          : "●●●●●"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Monthly Payslips & Download Statements */}
            <SectionCard>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <SectionTitle
                  icon={<Receipt className="size-4" />}
                  title="Monthly Payslips & Statements"
                  hint="Official generated salary slips available to view and download as PDF."
                />
              </div>

              {payslipsQuery.isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading payslips records…
                </div>
              ) : (payslipsQuery.data || []).length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                  <Receipt className="mx-auto size-7 text-muted-foreground/60" />
                  <p className="font-semibold text-foreground">No generated payslips found yet.</p>
                  <p>
                    Official payslips are generated at the end of every month by the HR/Payroll team.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border/80 overflow-hidden">
                  {(payslipsQuery.data || []).map((slip) => {
                    const [y, m] = slip.month_year.split("-");
                    const dateObj = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
                    const formattedMonth = dateObj.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });

                    return (
                      <div
                        key={slip.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-background/50 hover:bg-muted/30 transition-colors gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                            {slip.month_year.slice(5)}/{slip.month_year.slice(2, 4)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">
                                {formattedMonth}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {slip.status}
                              </span>
                              {slip.is_locked && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                  <Lock className="size-2.5" />
                                  Immutable
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Gross: {formatINR(slip.gross_earnings)} • Deductions: {formatINR(slip.total_deductions)} • Paid on {new Date(slip.payout_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end">
                          <div className="text-right font-mono">
                            <span className="text-xs text-muted-foreground block text-[10px]">Net Paid</span>
                            <span className="font-bold text-foreground text-sm text-primary">
                              {showSalary ? formatINR(slip.net_salary) : "●●●●●"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedPayslipModal({
                                  ...slip,
                                  employee_name: slip.employee_name || profile.data?.full_name || "Employee",
                                  employee_code: slip.employee_code || profile.data?.employee_id || "EMP-000",
                                  department: slip.department || profile.data?.department || "Business Intelligence",
                                  job_title: slip.job_title || profile.data?.job_title || "Staff",
                                });
                                setIsPayslipOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors text-foreground"
                            >
                              <FileText className="size-3.5 text-primary" />
                              <span>View Slip</span>
                            </button>
                            <button
                              onClick={() => {
                                setSelectedPayslipModal({
                                  ...slip,
                                  employee_name: slip.employee_name || profile.data?.full_name || "Employee",
                                  employee_code: slip.employee_code || profile.data?.employee_id || "EMP-000",
                                  department: slip.department || profile.data?.department || "Business Intelligence",
                                  job_title: slip.job_title || profile.data?.job_title || "Staff",
                                });
                                setIsPayslipOpen(true);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-primary/90 transition-all"
                            >
                              <Download className="size-3.5" />
                              <span>Download PDF</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Banking & Compliance Details */}
            <SectionCard>
              <SectionTitle
                icon={<CreditCard className="size-4" />}
                title="Banking & Tax Details"
                hint="Your registered bank account for salary disbursal and statutory IDs."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Bank Name"
                  value={form.bankName}
                  placeholder="e.g. HDFC Bank, SBI, ICICI"
                  readOnly={true}
                />
                <Field
                  label="Bank Account Number"
                  value={showSalary ? form.bankAccount : form.bankAccount ? "●●●● ●●●● " + form.bankAccount.slice(-4) : ""}
                  placeholder="Account number"
                  readOnly={true}
                />
                <Field
                  label="Bank IFSC Code"
                  value={showSalary ? form.bankIfsc : form.bankIfsc ? form.bankIfsc.slice(0, 4) + "●●●●" + form.bankIfsc.slice(-3) : ""}
                  placeholder="e.g. HDFC0001234"
                  readOnly={true}
                />
                <Field
                  label="PAN Number"
                  value={showSalary ? form.pan : form.pan ? form.pan.slice(0, 2) + "●●●●●●●" + form.pan.slice(-1) : ""}
                  placeholder="ABCDE1234F"
                  readOnly={true}
                />
                <Field
                  label="PF UAN Number"
                  value={showSalary ? form.uan : form.uan ? "●●●●●●●" + form.uan.slice(-3) : ""}
                  placeholder="Universal Account Number"
                  readOnly={true}
                />
                <Field
                  label="Provident Fund Account No."
                  value={form.pfNumber || "MH/BAN/000000/000"}
                  placeholder="PF Number"
                  readOnly={true}
                />
              </div>
            </SectionCard>
          </div>
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

      <PayslipViewModal
        payslip={selectedPayslipModal}
        open={isPayslipOpen}
        onOpenChange={setIsPayslipOpen}
      />
    </AppShell>
  );
}

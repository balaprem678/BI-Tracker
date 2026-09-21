import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  User,
  Briefcase,
  CalendarDays,
  DollarSign,
  PhoneCall,
  Eye,
  EyeOff,
  Power,
  ShieldAlert,
  Camera,
  Upload,
  Trash2,
  Link as LinkIcon,
  Loader2,
  X,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquareQuote,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getSessionInfo } from "@/lib/tracker.functions";
import { getEmployeeAllData } from "@/lib/team.functions";
import {
  getEmployeeProfileById,
  updateMyProfile,
  uploadEmployeeProfileImage,
  removeEmployeeProfileImage,
  setEmployeeProfileImageUrl,
  type MyProfile,
} from "@/lib/profile.functions";
import { toggleEmployeeActive } from "@/lib/admin.functions";
import { LEAVE_TYPES } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin/employee/$id")({
  head: () => ({
    meta: [{ title: "Employee Profile — BI Tracker" }],
  }),
  component: AdminEmployeeProfile,
});

// ---- reusable field components (same as profile.tsx) ----

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
          readOnly ? "cursor-default opacity-70 select-all" : ""
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
          readOnly ? "opacity-70 cursor-default" : ""
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
    staffSection: p?.staff_section ?? "IT Team",
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

function AdminEmployeeProfile() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const sessionFn = useServerFn(getSessionInfo);
  const getProfileFn = useServerFn(getEmployeeProfileById);
  const saveFn = useServerFn(updateMyProfile);
  const uploadImageFn = useServerFn(uploadEmployeeProfileImage);
  const removeImageFn = useServerFn(removeEmployeeProfileImage);
  const setImageUrlFn = useServerFn(setEmployeeProfileImageUrl);

  const session = useQuery({ queryKey: ["session"], queryFn: () => sessionFn() });
  const profile = useQuery({
    queryKey: ["employee-profile", id],
    queryFn: () => getProfileFn({ data: { id } }),
    enabled: !!id,
  });

  const getAllDataFn = useServerFn(getEmployeeAllData);
  const allDataQuery = useQuery({
    queryKey: ["employee-all-data", id],
    queryFn: () => getAllDataFn({ data: { employeeId: id } }),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const [activeTab, setActiveTab] = useState<Tab>("basic");
  const [form, setForm] = useState(initForm(null));
  const [showSalary, setShowSalary] = useState(false);
  const [urlModalOpen, setUrlModalOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile.data) setForm(initForm(profile.data));
  }, [profile.data]);

  const set = (key: keyof ReturnType<typeof initForm>) => (v: string) =>
    setForm((f) => ({ ...f, [key]: v }));

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          ...form,
          salary: form.salary ? Number(form.salary) : null,
          targetId: id,
        },
      }),
    onSuccess: () => {
      toast.success("Employee profile saved");
      qc.invalidateQueries({ queryKey: ["employee-profile", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadPhoto = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("File size must be less than 5MB");
      }
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed.");
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });

      return uploadImageFn({
        data: {
          targetUserId: id,
          fileBase64: base64,
          fileName: file.name,
          contentType: file.type,
        },
      });
    },
    onSuccess: () => {
      toast.success("Employee profile picture updated successfully!");
      qc.invalidateQueries({ queryKey: ["employee-profile", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (e: Error) => toast.error(e.message || "Failed to upload profile picture"),
  });

  const removePhoto = useMutation({
    mutationFn: () =>
      removeImageFn({
        data: {
          targetUserId: id,
        },
      }),
    onSuccess: () => {
      toast.success("Employee profile picture removed");
      qc.invalidateQueries({ queryKey: ["employee-profile", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to remove profile picture"),
  });

  const setPhotoUrl = useMutation({
    mutationFn: (url: string) =>
      setImageUrlFn({
        data: {
          targetUserId: id,
          photoUrl: url,
        },
      }),
    onSuccess: () => {
      toast.success("Employee profile picture URL updated!");
      setUrlModalOpen(false);
      setUrlInput("");
      qc.invalidateQueries({ queryKey: ["employee-profile", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["session"] });
    },
    onError: (e: Error) => toast.error(e.message || "Failed to set profile picture URL"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadPhoto.mutate(file);
  };

  if (!session.data) return null;

  const isAdmin = session.data.role === "admin" || session.data.role === "sub_admin";
  if (!isAdmin) {
    return (
      <AppShell session={session.data}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-muted-foreground">Access denied.</p>
        </div>
      </AppShell>
    );
  }

  const profileData = profile.data;
  const employeeId = form.employeeId || profileData?.employee_id || profileData?.id?.slice(-8).toUpperCase() || "—";

  const joiningDate = profileData?.joining_date
    ? new Date(profileData.joining_date)
    : profileData?.created_at
      ? new Date(profileData.created_at)
      : null;
  const daysWorked = joiningDate
    ? Math.max(0, Math.floor((Date.now() - joiningDate.getTime()) / 86400000))
    : 0;

  const empLeaves = useMemo(() => allDataQuery.data?.leaves ?? [], [allDataQuery.data?.leaves]);
  const empShifts = useMemo(() => allDataQuery.data?.shifts ?? [], [allDataQuery.data?.shifts]);

  const uniqueShiftDays = useMemo(() => {
    const set = new Set<string>();
    for (const s of empShifts) {
      if (s.clockIn) {
        set.add(s.clockIn.slice(0, 10));
      }
    }
    return set.size;
  }, [empShifts]);

  const presentDays = uniqueShiftDays > 0 ? uniqueShiftDays : (empShifts.length > 0 ? empShifts.length : (daysWorked > 0 ? daysWorked : 0));

  const approvedLeaves = useMemo(() => {
    return empLeaves.filter((l) => l.status === "Approved");
  }, [empLeaves]);

  const totalApprovedLeaveDays = useMemo(() => {
    return approvedLeaves.reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);
  }, [approvedLeaves]);

  const absentDays = Math.max(0, daysWorked - presentDays - totalApprovedLeaveDays);

  const lateDays = useMemo(() => {
    let count = 0;
    for (const s of empShifts) {
      if (s.clockIn) {
        const d = new Date(s.clockIn);
        if (d.getHours() > 10 || (d.getHours() === 10 && d.getMinutes() > 0)) {
          count++;
        }
      }
    }
    return count;
  }, [empShifts]);

  const leaveStatsByType = useMemo(() => {
    const map: Record<string, { approvedDays: number; pendingDays: number; totalDays: number; count: number }> = {};
    for (const type of LEAVE_TYPES) {
      map[type] = { approvedDays: 0, pendingDays: 0, totalDays: 0, count: 0 };
    }

    for (const l of empLeaves) {
      const lDays = calculateDays(l.startDate, l.endDate);
      const lType = l.leaveType || "";
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
  }, [empLeaves]);

  const toggleActiveFn = useServerFn(toggleEmployeeActive);

  const isSelf = session.data?.userId === id;
  const isActive = profileData ? profileData.is_active ?? true : true;

  const toggleActive = useMutation({
    mutationFn: (targetActive: boolean) =>
      toggleActiveFn({
        data: {
          id,
          active: targetActive,
        },
      }),
    onSuccess: (_, targetActive) => {
      toast.success(
        targetActive
          ? "Employee account reactivated successfully"
          : "Employee account deactivated. They have been logged out and open shifts ended."
      );
      qc.invalidateQueries({ queryKey: ["employee-profile", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleToggleActive = () => {
    if (isSelf) {
      toast.error("You cannot deactivate your own account.");
      return;
    }
    if (isActive) {
      if (
        confirm(
          `Are you sure you want to deactivate ${form.fullName || "this employee"}?\n\nThey will be immediately logged out, any active work shift will be clocked out, and they will not be able to sign in until reactivated.`
        )
      ) {
        toggleActive.mutate(false);
      }
    } else {
      toggleActive.mutate(true);
    }
  };

  return (
    <AppShell session={session.data}>
      <div className="mx-auto max-w-5xl">
        {/* Back + header */}
        <div className="mb-6">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Admin
          </Link>
        </div>

        {/* Deactivated Notice Banner */}
        {!isActive && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">Account Deactivated</p>
              <p className="mt-0.5 text-xs text-red-600/90 dark:text-red-400/90">
                This employee's login access is currently disabled. They are forcefully logged out and cannot track time or access their dashboard until this account is reactivated.
              </p>
            </div>
          </div>
        )}

        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-5">
            {/* Employee Profile Photo Avatar with Admin Quick Trigger */}
            <div className="group relative shrink-0">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex size-18 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted shadow-md transition-all hover:border-primary/50 hover:shadow-lg relative"
                title="Click to upload or change employee photo"
              >
                {uploadPhoto.isPending || removePhoto.isPending || setPhotoUrl.isPending ? (
                  <div className="flex flex-col items-center justify-center bg-background/90 p-2 text-center text-xs">
                    <Loader2 className="size-5 animate-spin text-primary" />
                    <span className="mt-1 text-[9px] font-semibold text-muted-foreground">Updating</span>
                  </div>
                ) : profileData?.photo_url ? (
                  <img src={profileData.photo_url} alt="Profile" className="size-full object-cover" />
                ) : (
                  <User className="size-8 text-muted-foreground" />
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 rounded-2xl">
                  <Camera className="size-6 text-white drop-shadow" />
                </div>
              </div>

              {/* Floating quick upload badge */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border border-border bg-background shadow hover:bg-muted text-foreground transition-transform hover:scale-110"
                title="Upload photo"
              >
                <Camera className="size-3.5 text-primary" />
              </button>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {profile.isLoading ? "Loading…" : form.fullName || "Employee Profile"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary uppercase">
                  Employee
                </span>
                <span>·</span>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 border border-emerald-500/20 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500"></span>
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 border border-red-500/20 dark:text-red-400">
                    <span className="size-1.5 rounded-full bg-red-500"></span>
                    Deactivated
                  </span>
                )}
                <span>·</span>
                <span>ID: {employeeId}</span>
                {profileData?.email && (
                  <>
                    <span>·</span>
                    <span>{profileData.email}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSelf && (
              <button
                type="button"
                onClick={handleToggleActive}
                disabled={toggleActive.isPending}
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                } disabled:opacity-50`}
              >
                <Power className="size-4" />
                {toggleActive.isPending
                  ? "Updating…"
                  : isActive
                  ? "Deactivate Account"
                  : "Reactivate Account"}
              </button>
            )}

            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !form.fullName.trim()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="size-4" />
              {save.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
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

        {/* Tab panels */}
        {activeTab === "basic" && (
          <div className="space-y-6">
            <SectionCard>
              <SectionTitle
                icon={<Camera className="size-4" />}
                title="Employee Profile Photo"
                hint="Upload or change this employee's official picture. Employees cannot edit their photo."
              />
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                {/* Photo Preview */}
                <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl border-2 border-primary/20 bg-muted shadow-inner flex items-center justify-center">
                  {uploadPhoto.isPending || removePhoto.isPending || setPhotoUrl.isPending ? (
                    <div className="flex flex-col items-center justify-center p-2 text-center">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span className="mt-1 text-[10px] font-medium text-muted-foreground">Uploading...</span>
                    </div>
                  ) : profileData?.photo_url ? (
                    <img
                      src={profileData.photo_url}
                      alt={form.fullName || "Profile"}
                      className="size-full object-cover"
                    />
                  ) : (
                    <User className="size-10 text-muted-foreground" />
                  )}
                </div>

                {/* Actions & Guidelines */}
                <div className="flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadPhoto.isPending || removePhoto.isPending}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-xs transition hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                    >
                      {uploadPhoto.isPending ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" />
                          Upload Picture
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUrlInput(profileData?.photo_url || "");
                        setUrlModalOpen(true);
                      }}
                      disabled={uploadPhoto.isPending || removePhoto.isPending}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-foreground transition hover:bg-secondary disabled:opacity-50"
                    >
                      <LinkIcon className="size-3.5 text-muted-foreground" />
                      Set Image URL
                    </button>

                    {profileData?.photo_url && (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove profile photo for ${form.fullName || "this employee"}?`)) {
                            removePhoto.mutate();
                          }
                        }}
                        disabled={removePhoto.isPending || uploadPhoto.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                      >
                        {removePhoto.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <p>
                      Supports JPEG, PNG, WebP or GIF up to 5MB. Uploaded photos are stored securely in Supabase Cloud Storage.
                    </p>
                    <p className="text-[11px] font-medium text-primary">
                      🔒 Only administrators can modify employee profile pictures. Employees can only view it.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <SectionTitle icon={<User className="size-4" />} title="Basic Information" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Employee ID (Custom / Manual)"
                  value={form.employeeId}
                  onChange={set("employeeId")}
                  placeholder="e.g. EMP-001"
                />
                <Field label="Full Name" value={form.fullName} onChange={set("fullName")} required placeholder="Full name" />
                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={set("gender")}
                  options={[
                    { value: "male", label: "Male" },
                    { value: "female", label: "Female" },
                    { value: "other", label: "Other" },
                    { value: "prefer_not", label: "Prefer not to say" },
                  ]}
                />
                <Field label="Date of Birth" value={form.dateOfBirth} onChange={set("dateOfBirth")} type="date" />
                <Field label="Mobile Number" value={form.mobile} onChange={set("mobile")} placeholder="+91 98765 43210" />
                <Field label="Email Address" value={profileData?.email ?? ""} readOnly />
                <div className="sm:col-span-2">
                  <Field label="Address" value={form.address} onChange={set("address")} placeholder="Street address" />
                </div>
                <Field label="City" value={form.city} onChange={set("city")} placeholder="e.g. Mumbai" />
                <Field label="State" value={form.state} onChange={set("state")} placeholder="e.g. Maharashtra" />
                <Field label="Pincode" value={form.pincode} onChange={set("pincode")} placeholder="e.g. 400001" />
              </div>
            </SectionCard>
          </div>
        )}

        {activeTab === "employment" && (
          <SectionCard>
            <SectionTitle icon={<Briefcase className="size-4" />} title="Employment Information" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Designation / Job Title" value={form.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Senior Analyst" />
              <Field label="Department" value={form.department} onChange={set("department")} placeholder="e.g. Business Intelligence" />
              <SelectField
                label="Staff Section"
                value={form.staffSection}
                onChange={set("staffSection")}
                options={[
                  { value: "IT Team", label: "IT Team" },
                  { value: "BI Staff", label: "BI Staff" },
                ]}
              />
              <SelectField
                label="Job Type"
                value={form.jobType}
                onChange={set("jobType")}
                options={[
                  { value: "full-time", label: "Full-time" },
                  { value: "part-time", label: "Part-time" },
                  { value: "contract", label: "Contract" },
                  { value: "intern", label: "Intern" },
                ]}
              />
              <Field label="Joining Date" value={form.joiningDate} onChange={set("joiningDate")} type="date" />
              <Field label="Work Location" value={form.workLocation} onChange={set("workLocation")} placeholder="e.g. Bangalore / Remote" />
            </div>
          </SectionCard>
        )}

        {activeTab === "leave" && (
          <div className="space-y-5">
            <SectionCard>
              <SectionTitle
                icon={<CalendarDays className="size-4" />}
                title="Attendance Overview"
                hint="Derived from employee shift records and approved leaves."
              />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Days Since Joining", value: daysWorked, color: "default" },
                  { label: "Present Days", value: presentDays, color: "green" },
                  { label: "Absent Days", value: absentDays, color: "red" },
                  { label: "Late Days", value: lateDays, color: "amber" },
                ].map((s) => (
                  <div
                    key={s.label}
                    className={`rounded-lg p-4 text-center ${
                      s.color === "green"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : s.color === "red"
                          ? "bg-red-500/10 text-red-600"
                          : s.color === "amber"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-muted"
                    }`}
                  >
                    <div className="text-2xl font-bold tabular-nums">{s.value}</div>
                    <div className="mt-1 text-xs opacity-75">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {LEAVE_TYPES.map((type) => {
                  const stats = leaveStatsByType[type] || { approvedDays: 0, pendingDays: 0, totalDays: 0, count: 0 };
                  const value = stats.approvedDays > 0 ? stats.approvedDays : stats.pendingDays > 0 ? stats.pendingDays : 0;
                  const isApproved = stats.approvedDays > 0;
                  const isPending = stats.pendingDays > 0;

                  return (
                    <div
                      key={type}
                      className={`rounded-lg p-3.5 text-center transition-all ${
                        isApproved
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                          : isPending
                            ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                            : "bg-muted"
                      }`}
                    >
                      <div className="text-xl font-bold tabular-nums">{value}</div>
                      <div className="mt-1 text-xs opacity-75 truncate">{type}</div>
                      {isPending && (
                        <div className="mt-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                          {stats.pendingDays} pending
                        </div>
                      )}
                      {!isPending && isApproved && (
                        <div className="mt-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                          {stats.approvedDays} approved
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <SectionTitle
                  icon={<CalendarDays className="size-4" />}
                  title="Leave History & Decisions"
                  hint="All leave requests submitted by this employee."
                />
                <Link
                  to="/admin/leave"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-all hover:bg-primary/20"
                >
                  <span>Manage in Leave Console</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {allDataQuery.isLoading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  Loading leave records…
                </div>
              ) : empLeaves.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
                  <CalendarDays className="mx-auto size-7 text-muted-foreground/60" />
                  <p className="font-semibold text-foreground">No leave requests found for this employee.</p>
                  <p>When the employee submits a leave request, it will appear here for review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {empLeaves.map((l) => {
                    const duration = calculateDays(l.startDate, l.endDate);
                    return (
                      <div
                        key={l.id}
                        className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/60 p-4 transition-all hover:border-border"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-foreground text-sm">
                              {l.startDate}
                              {l.endDate !== l.startDate ? ` → ${l.endDate}` : ""}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium">
                              ({duration} {duration === 1 ? "day" : "days"})
                            </span>
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${getLeaveTypeBadge(
                                l.leaveType
                              )}`}
                            >
                              {l.leaveType}
                            </span>
                            {l.timeSlot && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-600 dark:text-purple-400">
                                <Clock className="size-3" />
                                {l.timeSlot}
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

                        {(l.cleanReason || l.reason) && (
                          <p className="text-xs text-muted-foreground">
                            <strong className="text-foreground/80 font-medium">Reason:</strong>{" "}
                            {l.cleanReason || l.reason}
                          </p>
                        )}

                        {/* Manager Feedback */}
                        {l.reviewerNote && (
                          <div className="mt-1 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                            <MessageSquareQuote className="size-4 shrink-0 text-primary mt-0.5" />
                            <div>
                              <p className="font-semibold text-primary">Manager Feedback:</p>
                              <p className="text-muted-foreground mt-0.5">{l.reviewerNote}</p>
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
          <SectionCard>
            <div className="mb-5 flex items-start justify-between">
              <SectionTitle icon={<DollarSign className="size-4" />} title="Salary / HR Information" hint="Admin can view and edit all payroll details." />
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
              />
              <SelectField
                label="Salary Type"
                value={form.salaryType}
                onChange={set("salaryType")}
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
              />
              <Field
                label="PAN Number"
                value={showSalary ? form.pan : form.pan ? form.pan.slice(0, 2) + "●●●●●●●" + form.pan.slice(-1) : ""}
                onChange={set("pan")}
                placeholder="ABCDE1234F"
              />
              <Field
                label="UAN"
                value={showSalary ? form.uan : form.uan ? "●●●●●●●" + form.uan.slice(-3) : ""}
                onChange={set("uan")}
                placeholder="Universal Account Number"
              />
              <Field
                label="PF Number"
                value={showSalary ? form.pfNumber : form.pfNumber ? "●●●●●●●" + form.pfNumber.slice(-3) : ""}
                onChange={set("pfNumber")}
                placeholder="PF account number"
              />
              {/* <Field label="Experience" value={form.experience} onChange={set("experience")} placeholder="e.g. 3 years" /> */}
              {/* <Field label="Previous Company" value={form.previousCompany} onChange={set("previousCompany")} placeholder="e.g. Acme Corp" /> */}
            </div>
          </SectionCard>
        )}

        {activeTab === "emergency" && (
          <SectionCard>
            <SectionTitle icon={<PhoneCall className="size-4" />} title="Emergency Contact" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact Person" value={form.emergencyContactName} onChange={set("emergencyContactName")} placeholder="e.g. John Rivera" />
              <Field label="Relationship" value={form.emergencyContactRelation} onChange={set("emergencyContactRelation")} placeholder="e.g. Father, Spouse" />
              <Field label="Phone Number" value={form.emergencyContactPhone} onChange={set("emergencyContactPhone")} placeholder="+91 98765 43210" />
              <div className="sm:col-span-2">
                <Field label="Address" value={form.emergencyContactAddress} onChange={set("emergencyContactAddress")} placeholder="Emergency contact address" />
              </div>
            </div>
          </SectionCard>
        )}

        {/* Bottom save */}
        {/* <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-muted/30 px-5 py-3">
          <p className="text-xs text-muted-foreground">
            {profile.isLoading
              ? "Loading…"
              : `Employee since: ${profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : "—"}`}
          </p>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !form.fullName.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="size-4" />
            {save.isPending ? "Saving…" : "Save Changes"}
        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Set Image URL Modal Dialog */}
        {urlModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LinkIcon className="size-4 text-primary" />
                  <h3 className="text-base font-semibold text-foreground">Set Profile Image URL</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setUrlModalOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Enter a direct, public image URL (HTTPS) for this employee's profile picture:
              </p>

              <div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://images.example.com/avatar.jpg"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              {urlInput.trim() && (
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-2.5">
                  <img
                    src={urlInput}
                    alt="Preview"
                    className="size-10 rounded-lg object-cover border border-border"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="text-[11px] text-muted-foreground truncate">
                    Live URL Preview
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setUrlModalOpen(false)}
                  className="rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!urlInput.trim()) {
                      toast.error("Please enter a valid URL");
                      return;
                    }
                    setPhotoUrl.mutate(urlInput.trim());
                  }}
                  disabled={setPhotoUrl.isPending || !urlInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  {setPhotoUrl.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                  Save URL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

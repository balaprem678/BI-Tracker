import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access only");
}

export type TeamMember = {
  id: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  department: string | null;
  staffSection: string | null;
  hourlyRate: number;
  role: "admin" | "sub_admin" | "employee";
  isActive: boolean;
  isClockedIn: boolean;
  currentShiftClockIn: string | null;
  todayHoursWorked: number;
  todayLogsCount: number;
  totalShiftsCount: number;
  totalLoggedHours: number;
  createdAt: string;
};

export type EmployeeShift = {
  id: string;
  clockIn: string;
  clockOut: string | null;
  hours: number;
  note: string | null;
};

export type EmployeeHourlyLog = {
  id: string;
  logDate: string;
  hourSlot: number;
  startTime: string | null;
  endTime: string | null;
  project: string;
  task: string;
  category: string;
  status: string;
  createdAt: string;
};

export type EmployeeLeave = {
  id: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string;
  status: string;
  daysCount: number;
  createdAt: string;
};

export type EmployeeAllData = {
  profile: {
    id: string;
    fullName: string;
    email: string | null;
    jobTitle: string | null;
    department: string | null;
    staffSection: string | null;
    hourlyRate: number;
    role: "admin" | "sub_admin" | "employee";
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalShifts: number;
    totalClockedHours: number;
    totalLoggedTasks: number;
    totalLeaveDays: number;
    todayHours: number;
    isCurrentlyClockedIn: boolean;
    currentShiftStartedAt: string | null;
  };
  projectBreakdown: {
    project: string;
    hours: number;
    taskCount: number;
  }[];
  shifts: EmployeeShift[];
  hourlyLogs: EmployeeHourlyLog[];
  leaves: EmployeeLeave[];
};

export type TeamHourlyReportRow = {
  userId: string;
  name: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  staffSection: string | null;
  role: "admin" | "sub_admin" | "employee";
  hourlyRate: number;
  hoursWorked: number;
  loggedHours: number;
  cost: number;
  shifts: {
    date: string;
    clockIn: string;
    clockOut: string | null;
    hours: number;
    note: string | null;
  }[];
  logs: {
    log_date: string;
    hour_slot: number;
    task: string;
    category: string;
    project: string;
    start_time: string | null;
    end_time: string | null;
    status: string;
  }[];
};

function calculateDays(start: string, end: string) {
  try {
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
  } catch {
    return 1;
  }
}

export const getTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    await assertAdmin(context);

    const todayStr = new Date().toISOString().slice(0, 10);
    const startOfTodayIso = new Date(`${todayStr}T00:00:00`).toISOString();

    const [
      { data: profiles, error: pError },
      { data: roles },
      { data: openShifts },
      { data: todayShifts },
      { data: allShifts },
      { data: todayLogs },
      { data: allLogs },
    ] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, job_title, department, staff_section, hourly_rate, is_active, created_at")
        .order("full_name", { ascending: true }),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase.from("shifts").select("user_id, clock_in").is("clock_out", null),
      context.supabase
        .from("shifts")
        .select("user_id, clock_in, clock_out")
        .gte("clock_in", startOfTodayIso),
      context.supabase.from("shifts").select("user_id, clock_in, clock_out"),
      context.supabase.from("hourly_logs").select("user_id").eq("log_date", todayStr),
      context.supabase.from("hourly_logs").select("user_id"),
    ]);

    if (pError) throw new Error(pError.message);

    const adminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );
    const subAdminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "sub_admin").map((r: any) => r.user_id),
    );

    // Map open shifts
    const openShiftMap = new Map<string, string>();
    for (const os of openShifts ?? []) {
      openShiftMap.set(os.user_id, os.clock_in);
    }

    return (profiles ?? []).map((p: any) => {
      const isClockedIn = openShiftMap.has(p.id);
      const currentShiftClockIn = openShiftMap.get(p.id) ?? null;

      // Today's hours
      const userTodayShifts = (todayShifts ?? []).filter((s: any) => s.user_id === p.id);
      let todayHours = 0;
      for (const s of userTodayShifts) {
        if (s.clock_out) {
          todayHours +=
            (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3_600_000;
        } else {
          todayHours +=
            (Date.now() - new Date(s.clock_in).getTime()) / 3_600_000;
        }
      }

      const userAllShifts = (allShifts ?? []).filter((s: any) => s.user_id === p.id);
      const userTodayLogs = (todayLogs ?? []).filter((l: any) => l.user_id === p.id);
      const userAllLogs = (allLogs ?? []).filter((l: any) => l.user_id === p.id);

      const role: "admin" | "sub_admin" | "employee" = adminIds.has(p.id)
        ? "admin"
        : subAdminIds.has(p.id)
          ? "sub_admin"
          : "employee";

      return {
        id: p.id,
        fullName: p.full_name || p.email || "Unnamed Employee",
        email: p.email ?? null,
        jobTitle: p.job_title ?? null,
        department: p.department ?? null,
        staffSection: p.staff_section ?? "IT Team",
        hourlyRate: Number(p.hourly_rate ?? 0),
        role,
        isActive: p.is_active ?? true,
        isClockedIn,
        currentShiftClockIn,
        todayHoursWorked: Math.round(todayHours * 100) / 100,
        todayLogsCount: userTodayLogs.length,
        totalShiftsCount: userAllShifts.length,
        totalLoggedHours: userAllLogs.length,
        createdAt: p.created_at || new Date().toISOString(),
      };
    });
  });

const employeeInput = z.object({
  employeeId: z.string().uuid(),
});

export const getEmployeeAllData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof employeeInput>) => employeeInput.parse(input))
  .handler(async ({ data, context }): Promise<EmployeeAllData> => {
    await assertAdmin(context);
    const { employeeId } = data;

    const [
      { data: profile, error: pError },
      { data: roles },
      { data: shifts, error: sError },
      { data: logs, error: lError },
      { data: leaves, error: lvError },
    ] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, job_title, department, staff_section, hourly_rate, is_active, created_at, updated_at")
        .eq("id", employeeId)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", employeeId),
      context.supabase
        .from("shifts")
        .select("id, clock_in, clock_out, note, created_at")
        .eq("user_id", employeeId)
        .order("clock_in", { ascending: false }),
      context.supabase
        .from("hourly_logs")
        .select("id, log_date, hour_slot, start_time, end_time, project, task, category, status, created_at")
        .eq("user_id", employeeId)
        .order("log_date", { ascending: false })
        .order("hour_slot", { ascending: false }),
      context.supabase
        .from("leave_requests")
        .select("id, start_date, end_date, leave_type, reason, status, created_at")
        .eq("user_id", employeeId)
        .order("start_date", { ascending: false }),
    ]);

    if (pError) throw new Error(pError.message);
    if (sError) throw new Error(sError.message);
    if (lError) throw new Error(lError.message);
    if (lvError) throw new Error(lvError.message);
    if (!profile) throw new Error("Employee not found");

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");
    const role: "admin" | "sub_admin" | "employee" = isAdmin
      ? "admin"
      : isSubAdmin
        ? "sub_admin"
        : "employee";

    // Format shifts & compute stats
    let totalClockedHours = 0;
    let todayHours = 0;
    let isCurrentlyClockedIn = false;
    let currentShiftStartedAt: string | null = null;

    const todayStr = new Date().toISOString().slice(0, 10);

    const formattedShifts: EmployeeShift[] = (shifts ?? []).map((s: any) => {
      let durationHours = 0;
      if (s.clock_out) {
        durationHours =
          (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3_600_000;
        totalClockedHours += durationHours;
      } else {
        isCurrentlyClockedIn = true;
        currentShiftStartedAt = s.clock_in;
        durationHours = (Date.now() - new Date(s.clock_in).getTime()) / 3_600_000;
        totalClockedHours += durationHours;
      }

      if (String(s.clock_in).slice(0, 10) === todayStr) {
        todayHours += durationHours;
      }

      return {
        id: s.id,
        clockIn: s.clock_in,
        clockOut: s.clock_out ?? null,
        hours: Math.round(durationHours * 100) / 100,
        note: s.note ?? null,
      };
    });

    // Format logs & compute project breakdown
    const projectMap = new Map<string, { hours: number; count: number }>();

    const formattedLogs: EmployeeHourlyLog[] = (logs ?? []).map((l: any) => {
      const projName = l.project ? l.project.trim() : l.category || "General";
      const cur = projectMap.get(projName) ?? { hours: 0, count: 0 };
      cur.hours += 1;
      cur.count += 1;
      projectMap.set(projName, cur);

      return {
        id: l.id,
        logDate: l.log_date,
        hourSlot: l.hour_slot,
        startTime: l.start_time ?? null,
        endTime: l.end_time ?? null,
        project: l.project ?? "",
        task: l.task ?? "",
        category: l.category ?? "general",
        status: l.status ?? "Completed",
        createdAt: l.created_at,
      };
    });

    const projectBreakdown = [...projectMap.entries()]
      .map(([project, val]) => ({
        project,
        hours: val.hours,
        taskCount: val.count,
      }))
      .sort((a, b) => b.hours - a.hours);

    // Format leaves
    let totalLeaveDays = 0;
    const formattedLeaves: EmployeeLeave[] = (leaves ?? []).map((lv: any) => {
      const daysCount = calculateDays(lv.start_date, lv.end_date);
      if (lv.status?.toLowerCase() === "approved" || lv.status?.toLowerCase() === "pending") {
        totalLeaveDays += daysCount;
      }
      return {
        id: lv.id,
        startDate: lv.start_date,
        endDate: lv.end_date,
        leaveType: lv.leave_type,
        reason: lv.reason ?? "",
        status: lv.status ?? "Pending",
        daysCount,
        createdAt: lv.created_at,
      };
    });

    return {
      profile: {
        id: profile.id,
        fullName: profile.full_name || profile.email || "Unnamed Employee",
        email: profile.email ?? null,
        jobTitle: profile.job_title ?? null,
        department: profile.department ?? null,
        staffSection: profile.staff_section ?? "IT Team",
        hourlyRate: Number(profile.hourly_rate ?? 0),
        role,
        isActive: profile.is_active ?? true,
        createdAt: profile.created_at || new Date().toISOString(),
        updatedAt: profile.updated_at || new Date().toISOString(),
      },
      stats: {
        totalShifts: formattedShifts.length,
        totalClockedHours: Math.round(totalClockedHours * 100) / 100,
        totalLoggedTasks: formattedLogs.length,
        totalLeaveDays,
        todayHours: Math.round(todayHours * 100) / 100,
        isCurrentlyClockedIn,
        currentShiftStartedAt,
      },
      projectBreakdown,
      shifts: formattedShifts,
      hourlyLogs: formattedLogs,
      leaves: formattedLeaves,
    };
  });

const reportInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getTeamHourlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof reportInput>) => reportInput.parse(input))
  .handler(async ({ data, context }): Promise<TeamHourlyReportRow[]> => {
    await assertAdmin(context);

    const startIso = new Date(`${data.from}T00:00:00`).toISOString();
    const endIso = new Date(`${data.to}T23:59:59`).toISOString();

    const [
      { data: profiles },
      { data: roles },
      { data: shifts },
      { data: logs },
    ] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, email, job_title, department, staff_section, hourly_rate, is_active"),
      context.supabase.from("user_roles").select("user_id, role"),
      context.supabase
        .from("shifts")
        .select("user_id, clock_in, clock_out, note")
        .gte("clock_in", startIso)
        .lte("clock_in", endIso),
      context.supabase
        .from("hourly_logs")
        .select("user_id, hour_slot, task, category, log_date, project, start_time, end_time, status")
        .gte("log_date", data.from)
        .lte("log_date", data.to)
        .order("log_date", { ascending: true })
        .order("hour_slot", { ascending: true }),
    ]);

    const adminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );
    const subAdminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "sub_admin").map((r: any) => r.user_id),
    );

    const rows: TeamHourlyReportRow[] = (profiles ?? []).map((p: any) => {
      const userShifts = (shifts ?? []).filter((s: any) => s.user_id === p.id);
      const hours = userShifts.reduce((sum: number, s: any) => {
        if (s.clock_out) {
          return (
            sum +
            (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3_600_000
          );
        }
        return sum + (Date.now() - new Date(s.clock_in).getTime()) / 3_600_000;
      }, 0);

      const userLogs = (logs ?? []).filter((l: any) => l.user_id === p.id);
      const rate = Number(p.hourly_rate ?? 0);
      const role: "admin" | "sub_admin" | "employee" = adminIds.has(p.id)
        ? "admin"
        : subAdminIds.has(p.id)
          ? "sub_admin"
          : "employee";

      return {
        userId: p.id,
        name: p.full_name || p.email || "Unnamed Employee",
        email: p.email ?? null,
        department: p.department,
        jobTitle: p.job_title,
        staffSection: p.staff_section ?? "IT Team",
        role,
        hourlyRate: rate,
        hoursWorked: Math.round(hours * 100) / 100,
        loggedHours: userLogs.length,
        cost: Math.round(hours * rate * 100) / 100,
        shifts: userShifts
          .map((s: any) => ({
            date: String(s.clock_in).slice(0, 10),
            clockIn: s.clock_in,
            clockOut: s.clock_out ?? null,
            hours: s.clock_out
              ? Math.round(
                  ((new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) /
                    3_600_000) *
                    100,
                ) / 100
              : Math.round(
                  ((Date.now() - new Date(s.clock_in).getTime()) / 3_600_000) * 100,
                ) / 100,
            note: s.note ?? null,
          }))
          .sort((a: any, b: any) => (a.clockIn < b.clockIn ? 1 : -1)),
        logs: userLogs.map((l: any) => ({
          log_date: l.log_date,
          hour_slot: l.hour_slot,
          task: l.task,
          category: l.category,
          project: l.project ?? "",
          start_time: l.start_time ?? null,
          end_time: l.end_time ?? null,
          status: l.status ?? "",
        })),
      };
    });

    return rows.sort((a, b) => b.hoursWorked - a.hoursWorked);
  });

export const toggleEmployeeActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("profiles")
      .update({ is_active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

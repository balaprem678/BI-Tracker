import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export type Employee = {
  id: string;
  email: string | null;
  full_name: string;
  job_title: string | null;
  department: string | null;
  staff_section: string | null;
  hourly_rate: number;
  is_active: boolean;
  role: "admin" | "sub_admin" | "employee";
};

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Employee[]> => {
    await assertAdmin(context);
    const [{ data: profiles, error }, { data: roles }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, email, full_name, job_title, department, staff_section, hourly_rate, is_active")
        .order("full_name", { ascending: true }),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    if (error) throw new Error(error.message);
    const adminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
    );
    const subAdminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "sub_admin").map((r: any) => r.user_id),
    );
    return (profiles ?? []).map((p: any) => ({
      ...p,
      staff_section: p.staff_section ?? "IT Team",
      hourly_rate: Number(p.hourly_rate ?? 0),
      role: adminIds.has(p.id) ? "admin" : subAdminIds.has(p.id) ? "sub_admin" : "employee",
    }));
  });

const createInput = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
  fullName: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().max(120).optional().or(z.literal("")),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  staffSection: z.enum(["IT Team", "BI Staff"]).optional().default("IT Team"),
  hourlyRate: z.number().min(0).max(10000),
  role: z.enum(["employee", "admin", "sub_admin"]),
});

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createInput>) => createInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        job_title: data.jobTitle || null,
        department: data.department || null,
        staff_section: data.staffSection,
        hourly_rate: data.hourlyRate,
      },
    });
    if (error || !created.user) {
      return { ok: false as const, message: error?.message ?? "Could not create account" };
    }

    const userId = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        job_title: data.jobTitle || null,
        department: data.department || null,
        staff_section: data.staffSection,
        hourly_rate: data.hourlyRate,
        email: data.email,
      })
      .eq("id", userId);

    if (data.role === "admin" || data.role === "sub_admin") {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: data.role },
        { onConflict: "user_id,role" },
      );
    }

    return { ok: true as const, message: `${data.fullName} can now sign in.` };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
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

export type ReportRow = {
  userId: string;
  name: string;
  department: string | null;
  staffSection: string | null;
  hourlyRate: number;
  hoursWorked: number;
  loggedHours: number;
  cost: number;
  shifts: { date: string; clockIn: string; clockOut: string | null; hours: number }[];
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


const reportInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getHourlyReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof reportInput>) => reportInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const startIso = new Date(`${data.from}T00:00:00`).toISOString();
    const endIso = new Date(`${data.to}T23:59:59`).toISOString();

    const [{ data: profiles }, { data: shifts }, { data: logs }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id, full_name, department, staff_section, hourly_rate, is_active"),
      context.supabase
        .from("shifts")
        .select("user_id, clock_in, clock_out")
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

    const rows: ReportRow[] = (profiles ?? []).map((p: any) => {
      const userShifts = (shifts ?? []).filter((s: any) => s.user_id === p.id);
      const hours = userShifts
        .filter((s: any) => s.clock_out)
        .reduce(
          (sum: number, s: any) =>
            sum +
            (new Date(s.clock_out).getTime() - new Date(s.clock_in).getTime()) / 3_600_000,
          0,
        );
      const userLogs = (logs ?? []).filter((l: any) => l.user_id === p.id);
      const rate = Number(p.hourly_rate ?? 0);
      return {
        userId: p.id,
        name: p.full_name || "Unnamed",
        department: p.department,
        staffSection: p.staff_section ?? "IT Team",
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
              : 0,
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

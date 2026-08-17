import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Role = "admin" | "sub_admin" | "employee";

export type SessionInfo = {
  userId: string;
  email: string | null;
  fullName: string;
  jobTitle: string | null;
  department: string | null;
  hourlyRate: number;
  role: Role;
};

export const getSessionInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionInfo> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name, job_title, department, hourly_rate")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r) => r.role === "sub_admin");
    return {
      userId,
      email: profile?.email ?? null,
      fullName: profile?.full_name ?? "",
      jobTitle: profile?.job_title ?? null,
      department: profile?.department ?? null,
      hourlyRate: Number(profile?.hourly_rate ?? 0),
      role: isAdmin ? "admin" : isSubAdmin ? "sub_admin" : "employee",
    };
  });

export type Shift = {
  id: string;
  clock_in: string;
  clock_out: string | null;
  note: string | null;
};

export const getMyShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shifts")
      .select("id, clock_in, clock_out, note")
      .eq("user_id", context.userId)
      .order("clock_in", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as Shift[];
  });

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();
    if (open) return { ok: false as const, message: "You are already clocked in." };

    const { error } = await supabase.from("shifts").insert({ user_id: userId });
    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Clocked in." };
  });

export const clockOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { note?: string }) =>
    z.object({ note: z.string().trim().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("user_id", userId)
      .is("clock_out", null)
      .order("clock_in", { ascending: false })
      .maybeSingle();
    if (!open) return { ok: false as const, message: "No open shift to close." };

    const { error } = await supabase
      .from("shifts")
      .update({ clock_out: new Date().toISOString(), note: data.note ?? null })
      .eq("id", open.id);
    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Clocked out." };
  });

export type HourlyLog = {
  id: string;
  log_date: string;
  hour_slot: number;
  task: string;
  category: string;
  project: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

const LOG_COLUMNS =
  "id, log_date, hour_slot, task, category, project, start_time, end_time, status";

export const getMyHourlyLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("hourly_logs")
      .select(LOG_COLUMNS)
      .eq("user_id", context.userId)
      .eq("log_date", data.date)
      .order("hour_slot", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as HourlyLog[];
  });

const logInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: z.number().int().min(0).max(23),
  task: z.string().trim().min(1, "Describe the work").max(400),
  category: z.string().trim().min(1).max(40),
  project: z.string().trim().max(120).optional(),
  startTime: z.string().max(8).optional().or(z.literal("")),
  endTime: z.string().max(8).optional().or(z.literal("")),
  status: z.string().trim().min(1).max(40),
});

export const saveHourlyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof logInput>) => logInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hourly_logs").upsert(
      {
        user_id: context.userId,
        log_date: data.date,
        hour_slot: data.hour,
        task: data.task,
        category: data.category,
        project: data.project ?? "",
        start_time: data.startTime || null,
        end_time: data.endTime || null,
        status: data.status,
      },
      { onConflict: "user_id,log_date,hour_slot" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });


export const deleteHourlyLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("hourly_logs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

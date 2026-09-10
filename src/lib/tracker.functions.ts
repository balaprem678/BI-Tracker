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

    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");
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
  clock_in_lat?: number | null;
  clock_in_lng?: number | null;
  clock_in_location_name?: string | null;
  clock_out_lat?: number | null;
  clock_out_lng?: number | null;
  clock_out_location_name?: string | null;
  note: string | null;
};

export const getMyShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("shifts")
      .select("*")
      .eq("user_id", context.userId)
      .order("clock_in", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return (data ?? []) as Shift[];
  });

const clockInInput = z.object({
  latitude: z.number({ required_error: "Location is required to Clock In" }),
  longitude: z.number({ required_error: "Location is required to Clock In" }),
  locationName: z.string().optional().default(""),
});

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof clockInInput>) => clockInInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: open } = await supabase
      .from("shifts")
      .select("id")
      .eq("user_id", userId)
      .is("clock_out", null)
      .maybeSingle();
    if (open) return { ok: false as const, message: "You are already clocked in." };

    const locName = data.locationName || `${data.latitude}°, ${data.longitude}°`;

    const insertPayload: any = {
      user_id: userId,
      clock_in: new Date().toISOString(),
      clock_in_lat: data.latitude,
      clock_in_lng: data.longitude,
      clock_in_location_name: locName,
    };

    let { error } = await supabase.from("shifts").insert(insertPayload);
    if (error && (error.message?.includes("clock_in_lat") || error.message?.includes("schema cache"))) {
      const fallback = await supabase.from("shifts").insert({
        user_id: userId,
        clock_in: insertPayload.clock_in,
        note: `📍 Location: ${locName}`,
      });
      error = fallback.error;
    }

    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Clocked In successfully." };
  });

const clockOutInput = z.object({
  latitude: z.number({ required_error: "Location is required to Clock Out" }),
  longitude: z.number({ required_error: "Location is required to Clock Out" }),
  locationName: z.string().optional().default(""),
  note: z.string().trim().max(500).optional(),
});

export const clockOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof clockOutInput>) => clockOutInput.parse(input))
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

    const locName = data.locationName || `${data.latitude}°, ${data.longitude}°`;

    const updatePayload: any = {
      clock_out: new Date().toISOString(),
      clock_out_lat: data.latitude,
      clock_out_lng: data.longitude,
      clock_out_location_name: locName,
      note: data.note ?? null,
    };

    let { error } = await supabase
      .from("shifts")
      .update(updatePayload)
      .eq("id", open.id);

    if (error && (error.message?.includes("clock_out_lat") || error.message?.includes("schema cache"))) {
      const locOutText = `📍 Out: ${locName}`;
      const noteWithLoc = data.note ? `${data.note} (${locOutText})` : locOutText;
      const fallback = await supabase
        .from("shifts")
        .update({ clock_out: new Date().toISOString(), note: noteWithLoc })
        .eq("id", open.id);
      error = fallback.error;
    }

    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Clocked Out successfully." };
  });

export const getShiftAnalyticsToday = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = new Date().toISOString().split("T")[0];

    const [{ data: shifts }, { data: sessions }] = await Promise.all([
      supabase
        .from("shifts")
        .select("*")
        .eq("user_id", userId)
        .order("clock_in", { ascending: false }),
      supabase
        .from("project_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("session_date", today),
    ]);

    const activeShift = (shifts ?? []).find((s: any) => !s.clock_out);
    const now = Date.now();
    let todayShiftSeconds = 0;

    for (const s of shifts ?? []) {
      const cIn = new Date(s.clock_in).getTime();
      const cOut = s.clock_out ? new Date(s.clock_out).getTime() : now;
      if (s.clock_in.startsWith(today) || (s.clock_out && s.clock_out.startsWith(today))) {
        todayShiftSeconds += Math.max(0, Math.floor((cOut - cIn) / 1000));
      }
    }

    const todayProjectSeconds = (sessions ?? []).reduce(
      (acc: number, s: any) => acc + (s.duration_seconds || 0),
      0,
    );

    const unallocatedSeconds = Math.max(0, todayShiftSeconds - todayProjectSeconds);

    return {
      activeShift,
      todayShiftSeconds,
      todayProjectSeconds,
      unallocatedSeconds,
      todayShiftHours: Number((todayShiftSeconds / 3600).toFixed(2)),
      todayProjectHours: Number((todayProjectSeconds / 3600).toFixed(2)),
      unallocatedHours: Number((unallocatedSeconds / 3600).toFixed(2)),
      isClockedIn: Boolean(activeShift),
    };
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

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
  isActive: boolean;
  photoUrl?: string | null;
};

export const getSessionInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SessionInfo> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("email, full_name, job_title, department, hourly_rate, is_active")
        .eq("id", userId)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);

    let photoUrl: string | null = null;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      photoUrl = authUser?.user?.user_metadata?.photo_url ?? null;
    } catch {
      // Ignore user metadata fetch error
    }

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
      isActive: profile?.is_active ?? true,
      photoUrl,
    };
  });

export const checkMyAccountStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isActive: boolean; userId: string; role: Role }> => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("is_active").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");
    return {
      userId,
      isActive: profile?.is_active ?? true,
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
  endProjectSessionId: z.string().optional(),
  projectStatus: z.string().optional(),
  taskSummary: z.string().trim().optional(),
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

    // Handle running project sessions for this employee upon clock out
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const { data: userSessions } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("user_id", userId);

    let endedProjectName: string | null = null;

    if (data.endProjectSessionId) {
      const targetSession = (userSessions ?? []).find(
        (s: any) => s.id === data.endProjectSessionId,
      );
      if (targetSession) {
        const startMs = targetSession.start_time
          ? new Date(targetSession.start_time).getTime()
          : nowMs;
        const elapsed = isNaN(startMs)
          ? 0
          : Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const updatedDuration = (targetSession.duration_seconds || 0) + elapsed;

        await supabase
          .from("project_sessions")
          .update({
            end_time: nowIso,
            duration_seconds: updatedDuration,
            status: "Completed Today",
            task_summary: data.taskSummary || targetSession.task_summary || "Work completed on clock out.",
            daily_ended: true,
            updated_at: nowIso,
          })
          .eq("id", targetSession.id);

        if (targetSession.project_id && data.projectStatus) {
          await supabase
            .from("projects")
            .update({
              status: data.projectStatus,
              updated_at: nowIso,
            })
            .eq("id", targetSession.project_id);
        }

        endedProjectName = targetSession.project_name || "Project";
      }
    }

    const runningSessions = (userSessions ?? []).filter(
      (s: any) =>
        (!s.end_time || s.status === "In Progress") &&
        !s.daily_ended &&
        s.id !== data.endProjectSessionId,
    );

    const stoppedProjectNames: string[] = [];
    if (runningSessions.length > 0) {
      for (const sess of runningSessions) {
        const startMs = sess.start_time ? new Date(sess.start_time).getTime() : nowMs;
        const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const updatedDuration = (sess.duration_seconds || 0) + elapsed;

        await supabase
          .from("project_sessions")
          .update({
            end_time: nowIso,
            duration_seconds: updatedDuration,
            status: "Paused",
            updated_at: nowIso,
          })
          .eq("id", sess.id);

        if (sess.project_name) {
          stoppedProjectNames.push(sess.project_name);
        }
      }
    }

    const message = endedProjectName
      ? `Work summary saved for ${endedProjectName} and Clocked Out successfully.`
      : stoppedProjectNames.length > 0
        ? `Clocked Out successfully. Running project (${stoppedProjectNames.join(", ")}) was automatically stopped.`
        : "Clocked Out successfully.";

    return { ok: true as const, message };
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

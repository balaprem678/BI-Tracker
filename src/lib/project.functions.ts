import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Project = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  assigned_sub_admin_id: string | null;
  created_at: string;
  updated_at: string;
  sub_admin_name?: string | null;
  assigned_members_count?: number;
};

export type ProjectSession = {
  id: string;
  user_id: string;
  project_id: string;
  project_name: string;
  session_date: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  status: string;
  task_summary: string | null;
  daily_ended: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  staff_section?: string;
};

export const getMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Get all projects
    const { data: allProjects, error: pErr } = await supabase
      .from("projects")
      .select("id, name, code, description, status, assigned_sub_admin_id, created_at, updated_at")
      .order("created_at", { ascending: true });

    if (pErr) throw new Error(pErr.message);

    // Get assignments for current user
    const { data: assignments } = await supabase
      .from("project_assignments")
      .select("project_id")
      .eq("user_id", userId);

    const assignedIds = new Set((assignments ?? []).map((a: any) => a.project_id));

    // Filter projects assigned to this user (or if none assigned specifically, provide all active projects)
    const filtered = (allProjects ?? []).filter(
      (p: any) => assignedIds.size === 0 || assignedIds.has(p.id) || p.assigned_sub_admin_id === userId,
    );

    return (filtered.length > 0 ? filtered : allProjects ?? []) as Project[];
  });

export const getMyProjectSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input: { date: string }) =>
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sessions, error } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("session_date", data.date)
      .order("created_at", { ascending: true });

    if (error) throw new Error(error.message);
    return (sessions ?? []) as ProjectSession[];
  });

const startSessionInput = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const startProjectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof startSessionInput>) => startSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    // 1. Check for ANY currently running session for this user (where end_time is null or status is In Progress)
    const { data: activeSessions } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("session_date", data.date);

    // Auto-pause any session that is currently running for a different project
    if (activeSessions && activeSessions.length > 0) {
      for (const sess of activeSessions) {
        if (sess.project_id !== data.projectId && (!sess.end_time || sess.status === "In Progress")) {
          // Calculate elapsed seconds since start_time
          const startMs = new Date(sess.start_time).getTime();
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
        }
      }
    }

    // 2. Check if a session already exists today for the TARGET project
    const existingTarget = (activeSessions ?? []).find(
      (s: any) => s.project_id === data.projectId,
    );

    if (existingTarget) {
      if (existingTarget.daily_ended) {
        return { ok: false as const, message: "Work for this project has already been completed for today." };
      }

      // Resume target session
      const { error } = await supabase
        .from("project_sessions")
        .update({
          start_time: nowIso,
          end_time: null,
          status: "In Progress",
          updated_at: nowIso,
        })
        .eq("id", existingTarget.id);

      if (error) throw new Error(error.message);
      return { ok: true as const, message: `Resumed work on ${data.projectName}` };
    }

    // 3. Create a brand new session for the target project
    const { error } = await supabase.from("project_sessions").insert({
      user_id: userId,
      project_id: data.projectId,
      project_name: data.projectName,
      session_date: data.date,
      start_time: nowIso,
      end_time: null,
      duration_seconds: 0,
      status: "In Progress",
      task_summary: null,
      daily_ended: false,
      created_at: nowIso,
      updated_at: nowIso,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, message: `Started work on ${data.projectName}` };
  });

const pauseSessionInput = z.object({
  sessionId: z.string().min(1),
});

export const pauseProjectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof pauseSessionInput>) => pauseSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const { data: sess, error: fErr } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fErr || !sess) throw new Error("Session not found");

    if (!sess.end_time || sess.status === "In Progress") {
      const startMs = new Date(sess.start_time).getTime();
      const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
      const updatedDuration = (sess.duration_seconds || 0) + elapsed;

      const { error } = await supabase
        .from("project_sessions")
        .update({
          end_time: nowIso,
          duration_seconds: updatedDuration,
          status: "Paused",
          updated_at: nowIso,
        })
        .eq("id", sess.id);

      if (error) throw new Error(error.message);
    }

    return { ok: true as const, message: "Project paused" };
  });

const endProjectInput = z.object({
  sessionId: z.string().min(1),
  status: z.string().min(1).max(50),
  taskSummary: z.string().trim().min(1, "Please provide a task summary for today's work").max(600),
});

export const endProjectForToday = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof endProjectInput>) => endProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const { data: sess, error: fErr } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("id", data.sessionId)
      .eq("user_id", userId)
      .maybeSingle();

    if (fErr || !sess) throw new Error("Session not found");

    let updatedDuration = sess.duration_seconds || 0;
    if (!sess.end_time || sess.status === "In Progress") {
      const startMs = new Date(sess.start_time).getTime();
      const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
      updatedDuration += elapsed;
    }

    const { error } = await supabase
      .from("project_sessions")
      .update({
        end_time: nowIso,
        duration_seconds: updatedDuration,
        status: data.status,
        task_summary: data.taskSummary,
        daily_ended: true,
        updated_at: nowIso,
      })
      .eq("id", sess.id);

    if (error) throw new Error(error.message);
    return { ok: true as const, message: `Completed ${sess.project_name} for today.` };
  });

export const autoStopMidnightSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();

    const { data: openSessions } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("user_id", userId)
      .is("end_time", null);

    if (openSessions && openSessions.length > 0) {
      for (const sess of openSessions) {
        const startMs = new Date(sess.start_time).getTime();
        const elapsed = isNaN(startMs) ? 0 : Math.max(0, Math.floor((nowMs - startMs) / 1000));
        const updatedDuration = (sess.duration_seconds || 0) + elapsed;

        await supabase
          .from("project_sessions")
          .update({
            end_time: nowIso,
            duration_seconds: updatedDuration,
            status: "Auto-Stopped",
            daily_ended: true,
            updated_at: nowIso,
          })
          .eq("id", sess.id);
      }
    }

    return { ok: true as const };
  });

// --- ADMIN & SUB-ADMIN FUNCTIONS ---

export const getProjectsManagementList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Check roles
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");

    if (!isAdmin && !isSubAdmin) {
      throw new Error("Unauthorized to access project management.");
    }

    let query = supabase.from("projects").select("*").order("name", { ascending: true });

    // Sub-Admin (Team Lead/PM) only sees their assigned projects if restricted, or all projects they lead
    if (isSubAdmin && !isAdmin) {
      query = query.eq("assigned_sub_admin_id", userId);
    }

    const [{ data: projects }, { data: profiles }, { data: assignments }] = await Promise.all([
      query,
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("project_assignments").select("project_id, user_id"),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    return (projects ?? []).map((proj: any) => {
      const subAdmin = proj.assigned_sub_admin_id ? profileMap.get(proj.assigned_sub_admin_id) : null;
      const memberCount = (assignments ?? []).filter((a: any) => a.project_id === proj.id).length;
      return {
        ...proj,
        sub_admin_name: subAdmin?.full_name ?? "Unassigned",
        assigned_members_count: memberCount,
      } as Project;
    });
  });

const projectReportFilterInput = z.object({
  projectId: z.string().optional().or(z.literal("all")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  userId: z.string().optional().or(z.literal("all")),
  staffSection: z.string().optional().or(z.literal("all")),
});

export const getProjectHourlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof projectReportFilterInput>) => projectReportFilterInput.parse(input))
  .handler(async ({ data: filter, context }) => {
    const { supabase, userId } = context;

    // Check roles
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");

    if (!isAdmin && !isSubAdmin) {
      throw new Error("Unauthorized to access project reports.");
    }

    let sessionQuery = supabase
      .from("project_sessions")
      .select("*")
      .gte("session_date", filter.startDate)
      .lte("session_date", filter.endDate)
      .order("session_date", { ascending: false });

    if (filter.projectId && filter.projectId !== "all") {
      sessionQuery = sessionQuery.eq("project_id", filter.projectId);
    }

    if (filter.userId && filter.userId !== "all") {
      sessionQuery = sessionQuery.eq("user_id", filter.userId);
    }

    const [{ data: sessions }, { data: profiles }, { data: projects }] = await Promise.all([
      sessionQuery,
      supabase.from("profiles").select("id, full_name, email, staff_section"),
      supabase.from("projects").select("id, name, code, assigned_sub_admin_id"),
    ]);

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const projectMap = new Map((projects ?? []).map((p: any) => [p.id, p]));

    // If Sub-Admin (PM), filter out sessions for projects not assigned to them
    let userVisibleSessions = sessions ?? [];
    if (isSubAdmin && !isAdmin) {
      userVisibleSessions = userVisibleSessions.filter((s: any) => {
        const proj = projectMap.get(s.project_id);
        return proj && proj.assigned_sub_admin_id === userId;
      });
    }

    // Enrich sessions with user profile metadata
    const enriched = userVisibleSessions.map((s: any) => {
      const prof = profileMap.get(s.user_id);
      return {
        ...s,
        user_name: prof?.full_name ?? "Unknown Employee",
        user_email: prof?.email ?? "",
        staff_section: prof?.staff_section ?? "it_team",
      } as ProjectSession;
    });

    // Optional filter by staff_section (IT Team vs BI Staff)
    const filtered = filter.staffSection && filter.staffSection !== "all"
      ? enriched.filter((s) => s.staff_section === filter.staffSection)
      : enriched;

    // Calculate aggregated metrics
    const totalDurationSeconds = filtered.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const totalHours = Number((totalDurationSeconds / 3600).toFixed(2));

    // Group by project
    const projectSummary: Record<string, { name: string; seconds: number; hours: number; sessionCount: number }> = {};
    // Group by employee
    const employeeSummary: Record<string, { name: string; section: string; seconds: number; hours: number; sessionCount: number }> = {};

    for (const s of filtered) {
      if (!projectSummary[s.project_id]) {
        projectSummary[s.project_id] = { name: s.project_name, seconds: 0, hours: 0, sessionCount: 0 };
      }
      projectSummary[s.project_id].seconds += s.duration_seconds || 0;
      projectSummary[s.project_id].sessionCount += 1;

      if (!employeeSummary[s.user_id]) {
        employeeSummary[s.user_id] = {
          name: s.user_name || "Unknown",
          section: s.staff_section || "it_team",
          seconds: 0,
          hours: 0,
          sessionCount: 0,
        };
      }
      employeeSummary[s.user_id].seconds += s.duration_seconds || 0;
      employeeSummary[s.user_id].sessionCount += 1;
    }

    for (const k in projectSummary) {
      projectSummary[k].hours = Number((projectSummary[k].seconds / 3600).toFixed(2));
    }
    for (const k in employeeSummary) {
      employeeSummary[k].hours = Number((employeeSummary[k].seconds / 3600).toFixed(2));
    }

    return {
      sessions: filtered,
      totalHours,
      totalDurationSeconds,
      projectSummary: Object.values(projectSummary),
      employeeSummary: Object.values(employeeSummary),
    };
  });

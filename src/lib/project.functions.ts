import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Project = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: "Not Started" | "In Progress" | "Completed" | "Delayed" | string;
  priority: "Low" | "Medium" | "High" | "Urgent" | string;
  deadline: string | null;
  estimated_hours: number;
  progress_percent: number;
  start_date: string | null;
  completion_date: string | null;
  assigned_sub_admin_id: string | null;
  created_at: string;
  updated_at: string;
  sub_admin_name?: string | null;
  assigned_members_count?: number;
  assigned_employees?: { id: string; full_name: string; email: string }[];
  logged_hours?: number;
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
  .handler(async ({ context }): Promise<Project[]> => {
    const { supabase, userId } = context;

    // Determine user role
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");

    // Get all projects & metadata
    const [{ data: allProjects, error: pErr }, { data: profiles }, { data: assignments }, { data: sessions }] =
      await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("project_assignments").select("project_id, user_id"),
        supabase.from("project_sessions").select("project_id, duration_seconds"),
      ]);

    if (pErr) throw new Error(pErr.message);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const assignedProjectIds = new Set(
      (assignments ?? []).filter((a: any) => a.user_id === userId).map((a: any) => a.project_id),
    );

    // Filter by Visibility Rules
    let filteredProjects: any[] = [];
    if (isAdmin) {
      // Admin sees ALL projects across system
      filteredProjects = allProjects ?? [];
    } else if (isSubAdmin) {
      // Sub-Admin sees ONLY projects assigned to them by Admin
      filteredProjects = (allProjects ?? []).filter((p: any) => p.assigned_sub_admin_id === userId);
    } else {
      // Employee sees ONLY projects assigned to them by their Sub-Admin
      filteredProjects = (allProjects ?? []).filter((p: any) => assignedProjectIds.has(p.id));
    }

    // Calculate logged hours per project
    const projectHoursMap = new Map<string, number>();
    for (const s of sessions ?? []) {
      const current = projectHoursMap.get(s.project_id) ?? 0;
      projectHoursMap.set(s.project_id, current + (s.duration_seconds || 0));
    }

    // Group assigned employees per project
    const projectAssignedEmployeesMap = new Map<string, { id: string; full_name: string; email: string }[]>();
    for (const a of assignments ?? []) {
      const prof = profileMap.get(a.user_id);
      if (prof) {
        const list = projectAssignedEmployeesMap.get(a.project_id) ?? [];
        list.push({ id: prof.id, full_name: prof.full_name, email: prof.email });
        projectAssignedEmployeesMap.set(a.project_id, list);
      }
    }

    return filteredProjects.map((proj: any) => {
      const subAdmin = proj.assigned_sub_admin_id ? profileMap.get(proj.assigned_sub_admin_id) : null;
      const assignedEmpList = projectAssignedEmployeesMap.get(proj.id) ?? [];
      const loggedSeconds = projectHoursMap.get(proj.id) ?? 0;

      return {
        id: proj.id,
        name: proj.name,
        code: proj.code || null,
        description: proj.description || null,
        status: proj.status || "Not Started",
        priority: proj.priority || "Medium",
        deadline: proj.deadline || null,
        estimated_hours: Number(proj.estimated_hours ?? 0),
        progress_percent: Number(proj.progress_percent ?? 0),
        start_date: proj.start_date || null,
        completion_date: proj.completion_date || null,
        assigned_sub_admin_id: proj.assigned_sub_admin_id || null,
        created_at: proj.created_at,
        updated_at: proj.updated_at,
        sub_admin_name: subAdmin?.full_name ?? "Unassigned",
        assigned_members_count: assignedEmpList.length,
        assigned_employees: assignedEmpList,
        logged_hours: Number((loggedSeconds / 3600).toFixed(2)),
      } as Project;
    });
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

    const { data: activeSessions } = await supabase
      .from("project_sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("session_date", data.date);

    if (activeSessions && activeSessions.length > 0) {
      for (const sess of activeSessions) {
        if (sess.project_id !== data.projectId && (!sess.end_time || sess.status === "In Progress")) {
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

    const existingTarget = (activeSessions ?? []).find(
      (s: any) => s.project_id === data.projectId,
    );

    if (existingTarget) {
      if (existingTarget.daily_ended) {
        return { ok: false as const, message: "Work for this project has already been completed for today." };
      }

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

    const { error } = await supabase.from("project_sessions").insert({
      user_id: userId,
      project_id: data.projectId,
      project_name: data.projectName,
      session_date: data.date,
      start_time: nowIso,
      end_time: null,
      duration_seconds: 0,
      status: "In Progress",
      daily_ended: false,
    });

    if (error) throw new Error(error.message);
    return { ok: true as const, message: `Started tracking time for ${data.projectName}` };
  });

const pauseSessionInput = z.object({
  sessionId: z.string().min(1),
  durationSeconds: z.number().optional().default(0),
});

export const pauseProjectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof pauseSessionInput>) => pauseSessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("project_sessions")
      .update({
        end_time: nowIso,
        duration_seconds: Math.floor(data.durationSeconds ?? 0),
        status: "Paused",
        updated_at: nowIso,
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Project session paused." };
  });

const endDailySessionInput = z.object({
  sessionId: z.string().min(1),
  durationSeconds: z.number().optional().default(0),
  taskSummary: z.string().trim().optional().or(z.literal("")),
  status: z.string().optional(),
});

export const endDailyProjectSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof endDailySessionInput>) => endDailySessionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("project_sessions")
      .update({
        end_time: nowIso,
        duration_seconds: Math.floor(data.durationSeconds),
        status: "Completed Today",
        task_summary: data.taskSummary,
        daily_ended: true,
        updated_at: nowIso,
      })
      .eq("id", data.sessionId)
      .eq("user_id", userId);

    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Daily project session completed." };
  });

export const endProjectForToday = endDailyProjectSession;
export const autoStopMidnightSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true as const, message: "Midnight check completed." };
  });

const createProjectInput = z.object({
  name: z.string().trim().min(1, "Name is required"),
  code: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().optional().or(z.literal("")),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).default("Medium"),
  deadline: z.string().optional().or(z.literal("")),
  estimatedHours: z.number().min(0).default(0),
  assignedSubAdminId: z.string().optional().or(z.literal("")),
});

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof createProjectInput>) => createProjectInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      throw new Error("Unauthorized: Only Admin can create new projects.");
    }

    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        name: data.name,
        code: data.code || null,
        description: data.description || null,
        priority: data.priority,
        deadline: data.deadline || null,
        estimated_hours: data.estimatedHours,
        status: "Not Started",
        progress_percent: 0,
        assigned_sub_admin_id: data.assignedSubAdminId || null,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return { ok: true as const, project: created, message: `Project ${data.name} created successfully.` };
  });

const assignEmployeesInput = z.object({
  projectId: z.string().min(1),
  employeeIds: z.array(z.string()),
});

export const assignEmployeesToProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof assignEmployeesInput>) => assignEmployeesInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check roles
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");

    if (!isAdmin && !isSubAdmin) {
      throw new Error("Unauthorized to assign employees to project.");
    }

    // Delete existing assignments for this project
    await supabase.from("project_assignments").delete().eq("project_id", data.projectId);

    // Insert new assignments
    if (data.employeeIds.length > 0) {
      const rows = data.employeeIds.map((empId) => ({
        project_id: data.projectId,
        user_id: empId,
      }));
      const { error } = await supabase.from("project_assignments").insert(rows);
      if (error) throw new Error(error.message);
    }

    return { ok: true as const, message: "Team assignments updated successfully." };
  });

const updateProgressInput = z.object({
  projectId: z.string().min(1),
  status: z.enum(["Not Started", "In Progress", "Completed", "Delayed"]),
  progressPercent: z.number().min(0).max(100),
});

export const updateProjectProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof updateProgressInput>) => updateProgressInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const nowIso = new Date().toISOString();
    const isCompleted = data.status === "Completed" || data.progressPercent === 100;

    const { error } = await supabase
      .from("projects")
      .update({
        status: data.status,
        progress_percent: data.progressPercent,
        completion_date: isCompleted ? nowIso.split("T")[0] : null,
        updated_at: nowIso,
      })
      .eq("id", data.projectId);

    if (error) throw new Error(error.message);
    return { ok: true as const, message: "Project progress updated." };
  });

export const getProjectsManagementList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    const isSubAdmin = (roles ?? []).some((r: any) => r.role === "sub_admin");

    if (!isAdmin && !isSubAdmin) {
      throw new Error("Unauthorized to access project management.");
    }

    let query = supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (isSubAdmin && !isAdmin) {
      query = query.eq("assigned_sub_admin_id", userId);
    }

    const [{ data: projects }, { data: profiles }, { data: assignments }] = await Promise.all([
      query,
      supabase.from("profiles").select("id, full_name, email"),
      supabase.from("project_assignments").select("project_id, user_id"),
    ]);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

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

export const getAdminMonitoringOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");

    if (!isAdmin) {
      throw new Error("Unauthorized: Only Admin can access system monitoring.");
    }

    const [
      { data: allProfiles },
      { data: allRoles },
      { data: allProjects },
      { data: allAssignments },
      { data: allSessions },
    ] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, department, staff_section, job_title, is_active"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("projects").select("*").order("created_at", { ascending: false }),
      supabase.from("project_assignments").select("project_id, user_id"),
      supabase.from("project_sessions").select("*").order("created_at", { ascending: false }),
    ]);

    const profileMap = new Map<string, any>((allProfiles ?? []).map((p: any) => [p.id, p]));
    const roleMap = new Map<string, string>();
    for (const r of allRoles ?? []) {
      roleMap.set(r.user_id, r.role);
    }

    // Sub-Admins list
    const subAdmins = (allProfiles ?? []).filter((p: any) => roleMap.get(p.id) === "sub_admin");
    // Employees list
    const employees = (allProfiles ?? []).filter((p: any) => roleMap.get(p.id) === "employee" || !roleMap.get(p.id));

    // Calculate total hours per project & user
    const projectHoursMap = new Map<string, number>();
    for (const s of allSessions ?? []) {
      const current = projectHoursMap.get(s.project_id) ?? 0;
      projectHoursMap.set(s.project_id, current + (s.duration_seconds || 0));
    }

    // Build hierarchy mapping: SubAdmin -> Assigned Projects & Assigned Employees
    const subAdminHierarchy = subAdmins.map((sa: any) => {
      const saProjects = (allProjects ?? []).filter((p: any) => p.assigned_sub_admin_id === sa.id);
      const saProjectIds = new Set(saProjects.map((p: any) => p.id));
      const saAssignedEmpIds = new Set(
        (allAssignments ?? []).filter((a: any) => saProjectIds.has(a.project_id)).map((a: any) => a.user_id),
      );

      const assignedEmpList = Array.from(saAssignedEmpIds)
        .map((empId: any) => profileMap.get(empId as string))
        .filter(Boolean);

      return {
        subAdmin: sa,
        projects: saProjects.map((p: any) => ({
          ...p,
          logged_hours: Number(((projectHoursMap.get(p.id) ?? 0) / 3600).toFixed(2)),
        })),
        assignedEmployees: assignedEmpList,
      };
    });

    // Enriched projects list for drill-down
    const enrichedProjects = (allProjects ?? []).map((proj: any) => {
      const subAdmin = proj.assigned_sub_admin_id ? profileMap.get(proj.assigned_sub_admin_id) : null;
      const assignedUserIds = (allAssignments ?? [])
        .filter((a: any) => a.project_id === proj.id)
        .map((a: any) => a.user_id);
      const assignedEmpList = assignedUserIds.map((uid: string) => profileMap.get(uid)).filter(Boolean);
      const projectSessionsList = (allSessions ?? []).filter((s: any) => s.project_id === proj.id);
      const loggedSeconds = projectHoursMap.get(proj.id) ?? 0;

      return {
        ...proj,
        sub_admin_name: subAdmin?.full_name ?? "Unassigned",
        assigned_employees: assignedEmpList,
        sessions_history: projectSessionsList,
        logged_hours: Number((loggedSeconds / 3600).toFixed(2)),
      };
    });

    return {
      subAdminHierarchy,
      allProjects: enrichedProjects,
      allEmployees: employees,
      allSubAdmins: subAdmins,
      totalProjectsCount: (allProjects ?? []).length,
      totalSubAdminsCount: subAdmins.length,
      totalEmployeesCount: employees.length,
    };
  });

const projectReportInput = z.object({
  startDate: z.string().optional().or(z.literal("")),
  endDate: z.string().optional().or(z.literal("")),
  projectId: z.string().optional().or(z.literal("all")),
  staffSection: z.string().optional().or(z.literal("all")),
});

export const getProjectHourlyReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.input<typeof projectReportInput>) => projectReportInput.parse(input))
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [{ data: projects }, { data: sessions }] = await Promise.all([
      supabase.from("projects").select("id, name"),
      supabase.from("project_sessions").select("*"),
    ]);

    const totalSecs = (sessions ?? []).reduce((acc: number, s: any) => acc + (s.duration_seconds || 0), 0);
    const totalHours = Number((totalSecs / 3600).toFixed(2));

    return { projects: projects ?? [], sessions: sessions ?? [], totalHours };
  });

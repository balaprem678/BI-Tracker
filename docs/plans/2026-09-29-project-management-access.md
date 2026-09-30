# Employee Project Management Access & Professional Dashboard Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow administrators to grant any employee "Project Management Access" via a toggle in employee management, which dynamically surfaces the Project Management module in their sidebar and empowers them to create, assign, and manage enterprise projects and team hours.

**Architecture:** Extend `profiles` table with `can_manage_projects: boolean` alongside an updated RLS and server-side capability check. Expose this permission in session info, conditionally render the "Project Management" sidebar navigation item for authorized staff, add instantaneous toggle switches in `/team`, `/bi-staff`, and `/admin/employee/$id`, and align the `/project` workspace so Project Managers have full creation, team assignment, and milestone editing controls.

**Tech Stack:** TanStack Router, TanStack Start (Server Functions), Supabase PostgreSQL + RLS, TanStack Query, Tailwind CSS, Lucide React, Sonner Toasts.

---

### Task 1: Database Schema & Migration for Project Access

**Files:**
- Create: `supabase/migrations/20260929170000_add_project_management_access.sql`
- Modify: `src/integrations/supabase/types.ts`
- Modify: `src/integrations/supabase/local-db.ts`

**Step 1: Write migration SQL**
- Add column `can_manage_projects boolean NOT NULL DEFAULT false` to `public.profiles`.
- Create index on `public.profiles (can_manage_projects)`.
- Update RLS policies on `public.projects`, `public.project_assignments`, and `public.project_sessions` so that users with `can_manage_projects = true` in `profiles` can create, update, and manage projects.

```sql
-- Add can_manage_projects to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_manage_projects boolean NOT NULL DEFAULT false;

-- Policy update for projects table
DROP POLICY IF EXISTS "Allow admin/sub-admin full control on projects" ON public.projects;
CREATE POLICY "Allow admin and project managers full control on projects" ON public.projects
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_manage_projects = true
    )
  );

-- Policy update for project assignments
DROP POLICY IF EXISTS "Allow admin/sub-admin manage assignments" ON public.project_assignments;
CREATE POLICY "Allow admin and project managers manage assignments" ON public.project_assignments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND can_manage_projects = true
    )
  );
```

**Step 2: Update TypeScript types**
- Update `src/integrations/supabase/types.ts` to include `can_manage_projects?: boolean` in `profiles` Row, Insert, and Update definitions.

**Step 3: Update local mock DB**
- Update `src/integrations/supabase/local-db.ts` to support `can_manage_projects: boolean` on mock profiles.

---

### Task 2: Backend Permissions & Server Functions

**Files:**
- Modify: `src/lib/tracker.functions.ts`
- Modify: `src/lib/team.functions.ts`
- Modify: `src/lib/project.functions.ts`
- Modify: `src/lib/admin.functions.ts`

**Step 1: Session Info Enhancement**
- In `src/lib/tracker.functions.ts`:
  - Add `canManageProjects: boolean;` to `SessionInfo`.
  - In `getSessionInfo`: query `can_manage_projects` from `profiles`.
  - Return `canManageProjects: isAdmin || isSubAdmin || Boolean(profile?.can_manage_projects)`.

**Step 2: Toggle Project Management Access Server Function**
- In `src/lib/team.functions.ts` (or `admin.functions.ts`):
  - Add `toggleProjectManagementAccess`:
    ```ts
    export const toggleProjectManagementAccess = createServerFn({ method: "POST" })
      .middleware([requireSupabaseAuth])
      .validator((input: { employeeId: string; canManage: boolean }) =>
        z.object({ employeeId: z.string().min(1), canManage: z.boolean() }).parse(input)
      )
      .handler(async ({ data, context }) => {
        // Enforce admin permission
        // Update profiles.can_manage_projects = data.canManage
        // Return { ok: true, message: `Project management access ${data.canManage ? 'granted' : 'revoked'}.` }
      });
    ```
- Add `canManageProjects: boolean` to `TeamMember` and `EmployeeAllData` interfaces so it is returned by `getTeamMembers` and `getEmployeeAllData`.

**Step 3: Update Project Authorization Checks**
- In `src/lib/project.functions.ts`:
  - Create helper `checkCanManageProjects(supabase, userId)` that returns `true` if user is admin, sub_admin, or has `profiles.can_manage_projects = true`.
  - Update `createProject`, `updateProject`, `deleteProject`, and `assignEmployeesToProject` to use this check instead of strict `isAdmin`.
  - In `getMyProjects`: allow project managers to retrieve all organization projects or projects assigned to them for management.

---

### Task 3: Dynamic Sidebar Navigation & Route Guards

**Files:**
- Modify: `src/components/app-shell.tsx`
- Modify: `src/routes/_authenticated/project.tsx`

**Step 1: Conditional Sidebar Link in AppShell**
- In `src/components/app-shell.tsx`:
  - Check `session.canManageProjects`:
  ```tsx
  const canAccessProjects = role === "admin" || role === "sub_admin" || Boolean(session?.canManageProjects);
  ```
  - For standard employees:
    - If `canAccessProjects === true`: include `{ to: "/project", label: "Project Management", icon: FolderKanban }` in both `nav` (sidebar) and `tabs` (mobile / top tabs).
    - If `canAccessProjects === false`: hide the Project link from their navigation, keeping their workspace focused on shifts, tasks, and leaves.

**Step 2: Project Management UI Role Capabilities**
- In `src/routes/_authenticated/project.tsx`:
  - Set `isPrivileged = isAdmin || isSubAdmin || Boolean(session?.canManageProjects);`
  - Allow Project Managers to:
    - View and click `+ New Project` button
    - Open `ProjectEditModal` to edit deliverables, status, deadlines, and priorities
    - Open team assignment modal to assign/unassign colleagues
    - View the Project Workstation and team hours report

---

### Task 4: Employee Directory Toggle UI in IT Team & BI Staff

**Files:**
- Modify: `src/routes/_authenticated/team.tsx`
- Modify: `src/routes/_authenticated/bi-staff.tsx`
- Modify: `src/routes/_authenticated/admin.employee.$id.tsx`

**Step 1: IT Team Directory (`/team`)**
- Add table header column: `PROJECT ACCESS` (between Role/Job Title and Account Status).
- Render an interactive toggle switch / button for each employee:
  - If `member.canManageProjects`: Green badge with `ShieldCheck` icon or active switch (`PM Access / Enabled`).
  - If `!member.canManageProjects`: Muted gray switch (`No Access / Disabled`).
- Wire up a mutation calling `toggleProjectManagementAccessFn` with optimistic query cache update and toast notifications.
- Also include the toggle in grid view `EmployeeCard`.

**Step 2: BI Staff Directory (`/bi-staff`)**
- Add the identical `PROJECT ACCESS` column with instantaneous toggle switch in the staff directory table.

**Step 3: Employee Profile & Account Edit Screen (`/admin/employee/$id`)**
- Under "Account Status & Permissions", add an executive permission card:
  - Title: **Project Management Access**
  - Description: *"Enables the Project Management module in this employee's sidebar and grants authority to create projects, allocate resources, and track milestone progress."*
  - Toggle switch linked to the mutation.

---

### Task 5: Professional Project Dashboard Polish

**Files:**
- Modify: `src/routes/_authenticated/project.tsx`
- Modify: `src/components/project-workstation.tsx`

**Step 1: Project Manager Header & KPI Stats**
- If the current user is an employee with project management access, show a sleek badge in the header: `Project Manager Access`.
- Provide metric summary cards at the top of the project workspace:
  - Total Projects
  - Active & In-Progress
  - Overdue / Critical Priority
  - Total Workforce Allocated

**Step 2: Workstation & Assignment Verification**
- Verify assigned members receive project updates and can track hourly task logs seamlessly.

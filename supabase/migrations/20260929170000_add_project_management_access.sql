-- Migration: Add Project Management Access to profiles and update RLS policies

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS can_manage_projects boolean NOT NULL DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_can_manage_projects ON public.profiles (can_manage_projects);

-- Update RLS policies for projects
DROP POLICY IF EXISTS "Allow admin/sub-admin full control on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow admin and project managers full control on projects" ON public.projects;

CREATE POLICY "Allow admin and project managers full control on projects" ON public.projects
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND can_manage_projects = true
    )
  );

-- Update RLS policies for project assignments
DROP POLICY IF EXISTS "Allow admin/sub-admin manage assignments" ON public.project_assignments;
DROP POLICY IF EXISTS "Allow admin and project managers manage assignments" ON public.project_assignments;

CREATE POLICY "Allow admin and project managers manage assignments" ON public.project_assignments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND can_manage_projects = true
    )
  );

-- Update RLS policies for project sessions reading
DROP POLICY IF EXISTS "Admins and sub-admins can read all project sessions" ON public.project_sessions;
DROP POLICY IF EXISTS "Admins and project managers can read all project sessions" ON public.project_sessions;

CREATE POLICY "Admins and project managers can read all project sessions" ON public.project_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    ) OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND can_manage_projects = true
    )
  );

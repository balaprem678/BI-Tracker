-- Migration: Create projects, project_assignments, and project_sessions tables

-- 1. Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active', -- Active, Completed, On Hold
  assigned_sub_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Project Assignments (which employees/leads are assigned to which project)
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_project_user UNIQUE (project_id, user_id)
);

-- 3. Project Sessions (Automated dynamic real-time tracking replacing manual hourly logs)
CREATE TABLE IF NOT EXISTS public.project_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL, -- UUID or project key/name
  project_name TEXT NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_time TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'In Progress', -- In Progress, Paused, Completed, On Hold, Blocked, Auto-Stopped
  task_summary TEXT,
  daily_ended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_sessions_user_date ON public.project_sessions (user_id, session_date);
CREATE INDEX IF NOT EXISTS idx_project_sessions_status ON public.project_sessions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON public.project_assignments (user_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project ON public.project_assignments (project_id);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow authenticated read on projects" ON public.projects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/sub-admin full control on projects" ON public.projects
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    )
  );

CREATE POLICY "Allow authenticated read on assignments" ON public.project_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow admin/sub-admin manage assignments" ON public.project_assignments
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    )
  );

CREATE POLICY "Users can manage their own project sessions" ON public.project_sessions
  FOR ALL TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins and sub-admins can read all project sessions" ON public.project_sessions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'sub_admin')
    )
  );

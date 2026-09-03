-- ========================================================
-- BI-TRACKER SEED DATA MIGRATION SCRIPT
-- Optional: Run this in Supabase Dashboard > SQL Editor if you want to import
-- the default initial seed accounts, projects, and sample data into your new DB!
-- ========================================================

-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Insert Initial Default Auth Users (Password: BiTracker@07)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'BIadmin@bi-tracker.local',
  extensions.crypt('BiTracker@07', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"BI Admin","job_title":"System Administrator","department":"Management","staff_section":"IT Team","hourly_rate":50}',
  now(),
  now(),
  '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'subadmin@bi-tracker.local',
  extensions.crypt('BiTracker@07', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Sarah Jenkins","job_title":"Operations Lead","department":"Operations","staff_section":"IT Team","hourly_rate":38}',
  now(),
  now(),
  '', '', '', ''
),
(
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000003',
  'authenticated',
  'authenticated',
  'employee@bi-tracker.local',
  extensions.crypt('BiTracker@07', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alex Rivera","job_title":"Senior Analyst","department":"Business Intelligence","staff_section":"BI Staff","hourly_rate":30}',
  now(),
  now(),
  '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- 2. Ensure Profiles Exist
INSERT INTO public.profiles (id, email, full_name, job_title, department, staff_section, hourly_rate)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'BIadmin@bi-tracker.local', 'BI Admin', 'System Administrator', 'Management', 'IT Team', 50),
  ('a0000000-0000-4000-8000-000000000002', 'subadmin@bi-tracker.local', 'Sarah Jenkins', 'Operations Lead', 'Operations', 'IT Team', 38),
  ('a0000000-0000-4000-8000-000000000003', 'employee@bi-tracker.local', 'Alex Rivera', 'Senior Analyst', 'Business Intelligence', 'BI Staff', 30)
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  job_title = EXCLUDED.job_title,
  department = EXCLUDED.department,
  staff_section = EXCLUDED.staff_section,
  hourly_rate = EXCLUDED.hourly_rate;

-- 3. Assign User Roles
INSERT INTO public.user_roles (user_id, role)
VALUES
  ('a0000000-0000-4000-8000-000000000001', 'admin'),
  ('a0000000-0000-4000-8000-000000000002', 'sub_admin'),
  ('a0000000-0000-4000-8000-000000000003', 'employee')
ON CONFLICT (user_id, role) DO NOTHING;

-- 4. Seed Initial Projects
INSERT INTO public.projects (id, name, code, description, status, assigned_sub_admin_id)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Executive KPI Dashboard', 'EKPI-01', 'Executive business intelligence metrics, real-time KPI aggregations, and management dashboards.', 'Active', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'Customer Analytics Portal', 'CAP-02', 'Customer lifecycle analytics, churn prediction pipelines, and cohort retention visualizers.', 'Active', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'Data Warehouse ETL Migration', 'DW-03', 'Automated ETL extraction pipelines and PostgreSQL warehouse data consolidation.', 'Active', 'a0000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Project Assignments
INSERT INTO public.project_assignments (project_id, user_id)
VALUES
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000002')
ON CONFLICT (project_id, user_id) DO NOTHING;

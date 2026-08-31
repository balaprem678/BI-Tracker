ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_section TEXT NOT NULL DEFAULT 'IT Team';

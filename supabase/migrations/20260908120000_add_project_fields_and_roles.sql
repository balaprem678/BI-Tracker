-- Migration: Add enhanced project fields (priority, deadline, estimated_hours, progress_percent, start_date, completion_date)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'Medium';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deadline TIMESTAMPTZ;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS progress_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS completion_date DATE;

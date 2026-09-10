-- Migration: Add location tracking columns to public.shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lat NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_lng NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_location_name TEXT;

ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lat NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_lng NUMERIC;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_location_name TEXT;

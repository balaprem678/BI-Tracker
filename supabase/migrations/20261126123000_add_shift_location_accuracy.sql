-- Migration: Add location accuracy (in meters) columns to public.shifts
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_in_accuracy INTEGER;
ALTER TABLE public.shifts ADD COLUMN IF NOT EXISTS clock_out_accuracy INTEGER;

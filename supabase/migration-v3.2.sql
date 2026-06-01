-- =============================================
-- V3.2 Migration - Add holiday type
-- Run in Supabase SQL Editor
-- =============================================

-- Add 'holiday' to entry_type enum
ALTER TYPE entry_type ADD VALUE IF NOT EXISTS 'holiday';

-- Add bonus_percent column to work_entries (for holiday % calculation)
ALTER TABLE public.work_entries ADD COLUMN IF NOT EXISTS bonus_percent numeric(5,2) DEFAULT 100;

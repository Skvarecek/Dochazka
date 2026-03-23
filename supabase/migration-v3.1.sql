-- =============================================
-- V3.1 Migration
-- Run AFTER schema-v3.sql
-- =============================================

-- 1. Add unique constraint: one entry per user per day
ALTER TABLE public.work_entries ADD CONSTRAINT work_entries_user_date_unique UNIQUE (user_id, date);

-- 2. Add is_hidden flag to profiles (hidden admins/owners)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- 3. Allow admin to delete profiles
CREATE POLICY IF NOT EXISTS "profiles_delete_admin" ON public.profiles FOR DELETE TO authenticated
  USING (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

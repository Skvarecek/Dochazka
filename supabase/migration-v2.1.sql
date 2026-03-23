-- =============================================
-- V2.1 - Allow admin to insert entries for others
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop the restrictive insert policy
drop policy if exists "Users can insert own entries" on public.work_entries;

-- New insert policy: users can insert own, admins can insert for anyone
create policy "Users can insert own entries"
  on public.work_entries for insert to authenticated
  with check (
    auth.uid() = user_id
    OR exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Also allow admin to insert profiles (for creating employees)
create policy "Admins can insert profiles"
  on public.profiles for insert to authenticated
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    OR (select count(*) from public.profiles) = 0
  );

-- Allow the signup trigger to insert profiles
drop policy if exists "Admins can insert profiles" on public.profiles;
create policy "Anyone can insert own profile"
  on public.profiles for insert to authenticated
  with check (true);

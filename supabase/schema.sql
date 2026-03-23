-- =============================================
-- ATTENDANCE APP - Database Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- 1. PROFILES table (extends Supabase auth.users)
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- 2. ATTENDANCE_RECORDS table
-- =============================================
create table public.attendance_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  break_minutes integer default 30,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.attendance_records enable row level security;

create policy "Users can view own attendance"
  on public.attendance_records for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all attendance"
  on public.attendance_records for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert own attendance"
  on public.attendance_records for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own attendance"
  on public.attendance_records for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can manage all attendance"
  on public.attendance_records for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- 3. ABSENCES table (dovolené, nemocenské, ...)
-- =============================================
create type absence_type as enum ('vacation', 'sick', 'personal', 'other');
create type absence_status as enum ('pending', 'approved', 'rejected');

create table public.absences (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type absence_type not null default 'vacation',
  status absence_status not null default 'pending',
  start_date date not null,
  end_date date not null,
  note text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (end_date >= start_date)
);

alter table public.absences enable row level security;

create policy "Users can view own absences"
  on public.absences for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all absences"
  on public.absences for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can insert own absences"
  on public.absences for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own pending absences"
  on public.absences for update
  to authenticated
  using (auth.uid() = user_id and status = 'pending');

create policy "Admins can manage all absences"
  on public.absences for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================
-- 4. Auto-create profile on signup
-- =============================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    case
      when (select count(*) from public.profiles) = 0 then 'admin'
      else 'employee'
    end
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================
-- 5. Helper function: work hours calculation
-- =============================================
create or replace function public.calculate_work_hours(
  p_check_in timestamptz,
  p_check_out timestamptz,
  p_break_minutes integer default 30
)
returns numeric as $$
begin
  if p_check_in is null or p_check_out is null then
    return 0;
  end if;
  return round(
    (extract(epoch from p_check_out - p_check_in) / 3600.0) - (p_break_minutes / 60.0),
    2
  );
end;
$$ language plpgsql immutable;

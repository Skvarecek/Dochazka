-- =============================================
-- ATTENDANCE APP V2 - Schema Update for INEX-CZ
-- Run this in Supabase SQL Editor
-- =============================================

-- =============================================
-- Drop old tables and types (clean start)
-- =============================================
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.calculate_work_hours(timestamptz, timestamptz, integer);
drop table if exists public.absences cascade;
drop table if exists public.attendance_records cascade;
drop table if exists public.profiles cascade;
drop type if exists absence_type cascade;
drop type if exists absence_status cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- =============================================
-- 1. PROFILES table (rozšířeno o sazby)
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  hourly_rate numeric(10,2) default 0,
  vacation_rate numeric(10,2) default 0,
  sick_rate numeric(10,2) default 0,
  day_off_rate numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view all profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Admins can update any profile"
  on public.profiles for update to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================
-- 2. PROJECTS table (stavby/zakázky)
-- =============================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.projects enable row level security;

create policy "Authenticated users can view projects"
  on public.projects for select to authenticated using (true);

create policy "Admins can manage projects"
  on public.projects for all to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================
-- 3. WORK_ENTRIES table (zápis odpracovaných hodin)
-- =============================================
create type entry_type as enum ('work', 'vacation', 'sick', 'day_off');

create table public.work_entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  hours numeric(4,1) not null check (hours >= 0 and hours <= 24),
  entry_type entry_type not null default 'work',
  project_id uuid references public.projects(id) on delete set null,
  location text,
  note text,
  is_locked boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.work_entries enable row level security;

create policy "Users can view own entries"
  on public.work_entries for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can view all entries"
  on public.work_entries for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Users can insert own entries"
  on public.work_entries for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own unlocked entries"
  on public.work_entries for update to authenticated
  using (auth.uid() = user_id and is_locked = false);

create policy "Users can delete own unlocked entries"
  on public.work_entries for delete to authenticated
  using (auth.uid() = user_id and is_locked = false);

create policy "Admins can manage all entries"
  on public.work_entries for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- 4. LOANS table (půjčky)
-- =============================================
create table public.loans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  description text,
  date date not null default current_date,
  monthly_deduction numeric(10,2) default 0,
  remaining numeric(10,2) not null,
  is_paid_off boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.loans enable row level security;

create policy "Users can view own loans"
  on public.loans for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can manage all loans"
  on public.loans for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- 5. DEDUCTIONS table (poplatky/srážky)
-- =============================================
create table public.deductions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  amount numeric(10,2) not null,
  description text not null,
  month date not null, -- first day of month
  created_at timestamptz default now()
);

alter table public.deductions enable row level security;

create policy "Users can view own deductions"
  on public.deductions for select to authenticated
  using (auth.uid() = user_id);

create policy "Admins can manage all deductions"
  on public.deductions for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- 6. MONTHLY_LOCKS table (uzávěrky)
-- =============================================
create table public.monthly_locks (
  id uuid default uuid_generate_v4() primary key,
  month date not null unique, -- first day of month
  locked_by uuid references public.profiles(id),
  locked_at timestamptz default now()
);

alter table public.monthly_locks enable row level security;

create policy "Anyone can view locks"
  on public.monthly_locks for select to authenticated using (true);

create policy "Admins can manage locks"
  on public.monthly_locks for all to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- =============================================
-- 7. Auto-create profile on signup
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

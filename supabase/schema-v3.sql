-- =============================================
-- ATTENDANCE APP V3 - INEX-CZ Full Update
-- Run this in Supabase SQL Editor
-- =============================================

-- Drop old tables
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.deductions cascade;
drop table if exists public.loans cascade;
drop table if exists public.monthly_locks cascade;
drop table if exists public.work_entries cascade;
drop table if exists public.projects cascade;
drop table if exists public.profiles cascade;
drop type if exists entry_type cascade;
drop type if exists absence_type cascade;
drop type if exists absence_status cascade;

create extension if not exists "uuid-ossp";

-- =============================================
-- 1. PROFILES (zamestnanec + sazby)
-- =============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text not null,
  role text not null default 'employee' check (role in ('employee', 'admin')),
  hourly_rate numeric(10,2) default 0,
  sick_rate_percent numeric(5,2) default 60,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select to authenticated using (true);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_update_admin" on public.profiles for update to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "profiles_insert" on public.profiles for insert to authenticated with check (true);

-- =============================================
-- 2. PROJECTS (zakazky/stavby)
-- =============================================
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  address text,
  description text,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.projects enable row level security;
create policy "projects_select" on public.projects for select to authenticated using (true);
create policy "projects_admin" on public.projects for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- =============================================
-- 3. WORK_ENTRIES (zapis hodin)
-- entry_type: work, vacation, sick, day_off
-- Dovolena = 8h * sazba, Nemoc = 8h * sazba * (sick_rate_percent/100)
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
create policy "entries_select_own" on public.work_entries for select to authenticated using (auth.uid() = user_id);
create policy "entries_select_admin" on public.work_entries for select to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "entries_insert" on public.work_entries for insert to authenticated with check (
  auth.uid() = user_id OR exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
create policy "entries_update_own" on public.work_entries for update to authenticated using (auth.uid() = user_id and is_locked = false);
create policy "entries_delete_own" on public.work_entries for delete to authenticated using (auth.uid() = user_id and is_locked = false);
create policy "entries_admin" on public.work_entries for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- =============================================
-- 4. PAYROLL_ITEMS (srazky, premie, insolvence, atd)
-- type: deduction (minus), bonus (plus)
-- category: advance (zaloha), loan (pujcka), insolvence, insurance_health, insurance_social, internet, other, premium (odmena/premie)
-- =============================================
create table public.payroll_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  month date not null, -- first day of month
  type text not null check (type in ('deduction', 'bonus')),
  category text not null check (category in ('advance', 'loan', 'insolvence', 'insurance_health', 'insurance_social', 'internet', 'other', 'premium')),
  amount numeric(10,2) not null,
  description text,
  is_recurring boolean default false,
  created_at timestamptz default now()
);

alter table public.payroll_items enable row level security;
create policy "payroll_items_select_own" on public.payroll_items for select to authenticated using (auth.uid() = user_id);
create policy "payroll_items_admin" on public.payroll_items for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- =============================================
-- 5. LOANS (pujcky s mesicni splatkou)
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
  created_at timestamptz default now()
);

alter table public.loans enable row level security;
create policy "loans_select_own" on public.loans for select to authenticated using (auth.uid() = user_id);
create policy "loans_admin" on public.loans for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- =============================================
-- 6. MONTHLY_LOCKS (uzaverky)
-- =============================================
create table public.monthly_locks (
  id uuid default uuid_generate_v4() primary key,
  month date not null unique,
  locked_by uuid references public.profiles(id),
  locked_at timestamptz default now()
);

alter table public.monthly_locks enable row level security;
create policy "locks_select" on public.monthly_locks for select to authenticated using (true);
create policy "locks_admin" on public.monthly_locks for all to authenticated using (
  exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

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

-- =============================================
-- 8. Re-insert existing users as profiles
-- =============================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 'admin'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- V3.4 Migration - Tasks (úkoly)
-- BEZPEČNÉ: pouze přidává novou tabulku, nemění nic stávajícího
-- Run in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date date,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  is_done boolean DEFAULT false,
  done_at timestamptz,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id)
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_admin_all" ON public.tasks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

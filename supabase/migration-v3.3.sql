-- =============================================
-- V3.3 Migration - Paid status tracking
-- Run in Supabase SQL Editor
-- =============================================

CREATE TABLE IF NOT EXISTS public.payroll_paid (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month date NOT NULL,
  paid_at timestamptz DEFAULT now(),
  paid_by uuid REFERENCES public.profiles(id),
  UNIQUE(user_id, month)
);

ALTER TABLE public.payroll_paid ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payroll_paid_select" ON public.payroll_paid FOR SELECT TO authenticated USING (true);
CREATE POLICY "payroll_paid_admin" ON public.payroll_paid FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- V3.9 Migration - Ruční úprava čerpané dovolené
-- BEZPEČNÉ: pouze PŘIDÁVÁ novou tabulku, nemění ani nemaže nic stávajícího.
-- Lze spustit opakovaně. Spustit v Supabase SQL Editoru.
-- =============================================

-- Čerpaná dovolená se počítá ze záznamů docházky (entry_type = 'vacation').
-- Tahle tabulka k tomu drží ruční korekci za zaměstnance a rok (kladnou i zápornou),
-- např. za dovolenou vybranou před zavedením appky. Čerpáno = zapsané dny + days.
-- Na výplaty nemá vliv, jen na zůstatek dovolené.
CREATE TABLE IF NOT EXISTS public.vacation_adjustments (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  days numeric(5,1) NOT NULL CHECK (days BETWEEN -366 AND 366),
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year)
);

ALTER TABLE public.vacation_adjustments ENABLE ROW LEVEL SECURITY;

-- Zaměstnanec smí svou úpravu jen číst, měnit ji může pouze admin.
DROP POLICY IF EXISTS "vacation_adjustments_select_own" ON public.vacation_adjustments;
CREATE POLICY "vacation_adjustments_select_own" ON public.vacation_adjustments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "vacation_adjustments_admin" ON public.vacation_adjustments;
CREATE POLICY "vacation_adjustments_admin" ON public.vacation_adjustments
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

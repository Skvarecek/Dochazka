-- =============================================
-- V3.7 Migration - Nárok na dovolenou
-- BEZPEČNÉ: pouze PŘIDÁVÁ (nová tabulka + nový sloupec), nic nemění ani nemaže.
-- Lze spustit opakovaně. Spustit v Supabase SQL Editoru.
-- =============================================

-- 1) Firemní nastavení (vždy jediný řádek) s výchozím nárokem dovolené.
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  default_vacation_days numeric(4,1) NOT NULL DEFAULT 21
    CHECK (default_vacation_days >= 0 AND default_vacation_days <= 365)
);

INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings_admin" ON public.app_settings;
CREATE POLICY "app_settings_admin" ON public.app_settings
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2) Vlastní nárok zaměstnance. NULL = platí firemní výchozí nárok.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vacation_days numeric(4,1)
  CHECK (vacation_days IS NULL OR (vacation_days >= 0 AND vacation_days <= 365));

-- Hotovo. Čerpané dny se nikam neukládají — appka je počítá ze záznamů
-- typu "vacation" v daném roce.

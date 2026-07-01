-- =============================================
-- V3.6 Migration - Řidič: hodiny řízení u zápisu
-- BEZPEČNÉ: pouze PŘIDÁVÁ sloupec, nemění ani nemaže nic stávajícího.
-- Spustit v Supabase SQL Editoru.
-- =============================================

-- Hodiny za volantem daný den (0 = neřídil). Proplácí se běžnou hodinovou
-- sazbou navíc k odpracovaným hodinám; eviduje se odděleně, aby bylo poznat,
-- co je práce a co jízda.
ALTER TABLE public.work_entries
  ADD COLUMN IF NOT EXISTS driver_hours numeric(4,1) NOT NULL DEFAULT 0
  CHECK (driver_hours >= 0 AND driver_hours <= 24);

-- Hotovo. RLS politiky pokrývají i nový sloupec.

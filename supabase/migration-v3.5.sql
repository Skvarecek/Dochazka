-- =============================================
-- V3.5 Migration - Úkoly: status (kanban board) + pořadí
-- BEZPEČNÉ: pouze PŘIDÁVÁ sloupce, nemění ani nemaže nic stávajícího.
-- Existující úkoly i kód, který status nezná, fungují dál.
-- Spustit v Supabase SQL Editoru.
-- =============================================

-- 1) Stav úkolu pro board (4 sloupce). Výchozí 'todo' = K udělání.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'todo'
  CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled'));

-- 2) Pořadí pro drag-and-drop v rámci sloupce (menší číslo = výš).
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- 3) Dopočítat status existujících úkolů z is_done
--    (hotové -> 'done'), zbytek zůstane 'todo'.
UPDATE public.tasks
  SET status = 'done'
  WHERE is_done = true AND status = 'todo';

-- 4) Inicializovat sort_order podle data vytvoření v rámci každého stavu
--    (nejnovější nahoře), ať board nezačíná zpřeházený.
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at DESC) AS rn
  FROM public.tasks
)
UPDATE public.tasks t
  SET sort_order = ordered.rn
  FROM ordered
  WHERE t.id = ordered.id;

-- Hotovo. RLS politika "tasks_admin_all" platí i pro nové sloupce, nic dalšího není potřeba.

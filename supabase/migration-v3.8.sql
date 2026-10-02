-- =============================================
-- V3.8 Migration - Pojistka: citlivé údaje zaměstnance smí měnit jen admin
-- BEZPEČNÉ: pouze PŘIDÁVÁ funkci + trigger, nemění data ani stávající pravidla.
-- Lze spustit opakovaně. Spustit v Supabase SQL Editoru.
-- Vrácení zpět:
--   DROP TRIGGER IF EXISTS protect_profile_admin_fields ON public.profiles;
-- =============================================

-- Pravidla "profiles_update_own" a "profiles_insert" dovolují přihlášenému uživateli
-- zapsat do vlastního řádku cokoli, tedy i roli, sazby, skrytí a nárok dovolené.
-- Trigger tyhle sloupce ne-adminům uzamkne. Jméno a vše, co dělá admin, zůstává
-- beze změny; zápis hodin (work_entries) se netýká vůbec.
CREATE OR REPLACE FUNCTION public.protect_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col text;
BEGIN
  -- Bez přihlášeného uživatele (SQL Editor, service role, registrace přes auth) neomezuj.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ne-admin si profil může založit jen jako běžný zaměstnanec s výchozími hodnotami.
    -- jsonb_populate_record přeskočí klíče, které v tabulce (ještě) nejsou.
    NEW := jsonb_populate_record(NEW, jsonb_build_object(
      'role', 'employee', 'hourly_rate', 0, 'sick_rate_percent', 60,
      'is_hidden', false, 'vacation_days', NULL));
    RETURN NEW;
  END IF;

  -- Porovnání přes jsonb, aby funkce nezávisela na tom, zda sloupec už existuje.
  FOREACH col IN ARRAY ARRAY['role', 'hourly_rate', 'sick_rate_percent', 'is_hidden', 'vacation_days'] LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'Údaj "%" může měnit jen administrátor.', col USING ERRCODE = '42501';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_admin_fields ON public.profiles;
CREATE TRIGGER protect_profile_admin_fields
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_admin_fields();

# Docházka — projektová paměť

Firemní **docházkový a provozní systém**: evidence odpracovaných hodin, dovolených/absencí,
výplaty (payroll), zakázky (projects), úkoly (tasks) a měsíční přehledová mřížka (board).
Web aplikace, kterou klub/firma reálně používá v provozu.

## Tech stack
- **Next.js 14 (App Router) + TypeScript + Tailwind CSS**, klientské komponenty (`"use client"`).
- **Supabase** = auth (email/heslo) + Postgres + **RLS** (zabezpečení na úrovni DB).
  Klienti: `src/lib/supabase-browser.ts` (browser) a `src/lib/supabase-server.ts` (server).
- Hostováno na **Vercel**, repo **Skvarecek/Dochazka**, produkce na **dochazka-rho.vercel.app**.

## Příkazy
- `npm run dev` — vývojový server (potřebuje `.env.local` se Supabase klíči).
- `npm run build` — produkční build. **Lokálně padá na prerenderu**, pokud chybí Supabase env
  (`.env.local`) — to je normální, na Vercelu (kde klíče jsou) build prochází.
- `npx tsc --noEmit` — **spolehlivá typová kontrola** bez potřeby env. Tímto ověřuj změny.
- `npm run lint` — ESLint **není nakonfigurovaný** (spustí interaktivní setup), nepoužívat.

## Workflow nasazení (důležité)
Uživatel **není vývojář** a git neřeší — git si řídí asistent. Postup:
1. Změny dělej na **nové větvi** (např. `feature/<co>`), ne přímo na `main`.
2. Push větve → Vercel udělá **preview deploy** (vlastní URL `dochazka-git-<vetev>-…vercel.app`).
3. Uživatel si preview prohlédne a schválí.
4. Teprve pak **merge do `main`** (fast‑forward) + push → **produkční deploy** na `dochazka-rho.vercel.app`.
5. Po sloučení **smaž větev** (lokálně i na originu).

- **Push do `main` = produkční deploy.** Větve/PR = preview deploy.
- Stav deploymentů a URL ověřuj přes Vercel MCP (projekt `dochazka`,
  `prj_Er89asg9NdGdegY1BxuAT5Sr01qg`, team `team_X9F4Yaf4vIHzrZT5DgHWdw8u`).

## Trvalá pravidla (guardrails)
1. **Měnit jen to, co je vyžádané. Nesahat na chod appky ani na data v Supabase.**
2. **Změny DB jen jako bezpečné, *přidávající* migrace** v `supabase/migration-*.sql`
   (vzor: „BEZPEČNÉ: pouze přidává…"). **Migrace nikdy nespouštět proti produkční DB z kódu** —
   uživatel je spustí ručně v **Supabase → SQL Editor**. Nikdy nemazat/neměnit existující sloupce
   bez výslovného zadání.
3. **Profesionální úroveň grafiky i kódu**, sjednocené s designem appky (viz tokeny níže).
4. **Neměnit UX/workflow bez vyžádání.**

## Kde co je
- `src/app/(dashboard)/` — chráněné stránky (sidebar layout):
  - `dashboard/`, `hours/` — uživatelské; `admin/` — admin sekce
    (`tasks`, `board` = měsíční mřížka, `payroll`, `projects`, `backup`, `page` = přehled).
  - Admin stránky gateují přes `profile.role === "admin"`.
- `src/app/login/`, `src/app/auth/callback/` — přihlášení a OAuth callback.
- `src/lib/` — `supabase-browser.ts`, `supabase-server.ts`, `types.ts`, `utils.ts`.
- `src/middleware.ts` — auth middleware.
- `supabase/` — `schema*.sql` + `migration-*.sql` (postupné verze v2.1 … v3.5).

## Konvence
- **UI texty česky, identifikátory v kódu anglicky.**
- Design tokeny (Tailwind): accent **`brand`** (indigová `#4c6ef5`), neutrály `surface` a `ink`.
  Komponentní třídy: `card`, `btn-primary` / `btn-secondary` / `btn-danger`, `input`, `label`,
  `badge`, animace `animate-in`. Fonty: **DM Sans** (text), **Outfit** (`font-display`).
- `package-lock.json` se **necommituje** (repo lockfile nemá, Vercel řeší `npm install`).

## Datový model — úkoly (`tasks`)
`title, description, priority(low|medium|high|urgent), due_date, project_id, is_done, done_at,
created_at, created_by` + (od **migrace v3.5**) `status(todo|in_progress|done|cancelled)` a
`sort_order`. Při změně stavu drž `is_done`/`done_at` **v sync se `status`** (`done` ⇒ `is_done=true`).
Stránka Úkoly: seznam ↔ kanban board (4 sloupce) s drag‑and‑drop (`@dnd-kit`), hledání + filtry,
editace v modalu. Pouze pro adminy.

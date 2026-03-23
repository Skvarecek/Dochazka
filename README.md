# 🕐 Docházka – Firemní docházkový systém

Moderní webová aplikace pro správu docházky zaměstnanců. Built with **Next.js 14**, **Supabase**, **Tailwind CSS**.

## Funkce

- ✅ **Přehled odpracovaných hodin** – měsíční zobrazení, statistiky
- ✅ **Správa dovolených a absencí** – žádosti, schvalování
- ✅ **Admin panel** – správa zaměstnanců, přehled docházky, schvalování absencí
- ✅ **Přihlášení/registrace** – Supabase Auth s email/heslo
- ✅ **Responzivní design** – funguje na mobilu i desktopu
- ✅ **RLS (Row Level Security)** – zabezpečení dat na úrovni databáze

---

## 🚀 Jak spustit projekt

### Předpoklady

- [Node.js](https://nodejs.org/) 18+
- [Supabase](https://supabase.com/) účet (free tier stačí)
- [GitHub](https://github.com/) účet
- [Vercel](https://vercel.com/) účet

---

### KROK 1: Nastavení Supabase

1. Jdi na [supabase.com](https://supabase.com/) a vytvoř nový projekt
2. Po vytvoření projektu jdi do **SQL Editor**
3. Zkopíruj celý obsah souboru `supabase/schema.sql` a spusť ho
4. Jdi do **Project Settings → API** a zapiš si:
   - `Project URL` → to bude `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → to bude `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> ⚠️ **Důležité**: V **Authentication → URL Configuration** nastav:
> - Site URL: `http://localhost:3000` (pro vývoj) / tvoje Vercel URL (pro produkci)
> - Redirect URLs: přidej `http://localhost:3000/auth/callback` a `https://tvoje-app.vercel.app/auth/callback`

---

### KROK 2: Lokální instalace

```bash
# Klonuj repozitář (nebo zkopíruj soubory)
cd attendance-app

# Nainstaluj závislosti
npm install

# Vytvoř .env.local soubor
cp .env.local.example .env.local
```

Uprav `.env.local` a vyplň hodnoty ze Supabase:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

```bash
# Spusť vývojový server
npm run dev
```

Otevři `http://localhost:3000` – registruj se a **první zaregistrovaný uživatel bude automaticky admin**.

---

### KROK 3: Push na GitHub

```bash
# Inicializuj Git repozitář
git init
git add .
git commit -m "Initial commit: attendance app"

# Vytvoř repozitář na GitHubu (přes web nebo GitHub CLI)
gh repo create attendance-app --public --source=. --push

# Nebo ručně:
git remote add origin https://github.com/TVUJ-USERNAME/attendance-app.git
git branch -M main
git push -u origin main
```

---

### KROK 4: Nasazení na Vercel

1. Jdi na [vercel.com](https://vercel.com/) a klikni na **"Add New Project"**
2. Importuj svůj GitHub repozitář `attendance-app`
3. V sekci **Environment Variables** přidej:
   - `NEXT_PUBLIC_SUPABASE_URL` = tvoje Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tvůj anon key
4. Klikni **Deploy**

Po nasazení nezapomeň v Supabase přidat Vercel URL do:
- **Authentication → URL Configuration → Site URL**: `https://tvoje-app.vercel.app`
- **Authentication → URL Configuration → Redirect URLs**: `https://tvoje-app.vercel.app/auth/callback`

---

## 📁 Struktura projektu

```
attendance-app/
├── src/
│   ├── app/
│   │   ├── globals.css          # Globální styly + Tailwind
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx             # Redirect na /dashboard
│   │   ├── login/page.tsx       # Přihlášení & registrace
│   │   ├── auth/callback/       # OAuth callback
│   │   └── (dashboard)/         # Chráněné stránky
│   │       ├── layout.tsx       # Sidebar layout
│   │       ├── dashboard/       # Hlavní přehled + check-in
│   │       ├── hours/           # Odpracované hodiny
│   │       ├── absences/        # Dovolené & absence
│   │       └── admin/           # Administrace
│   ├── lib/
│   │   ├── supabase-browser.ts  # Supabase client (browser)
│   │   ├── supabase-server.ts   # Supabase client (server)
│   │   ├── types.ts             # TypeScript typy
│   │   └── utils.ts             # Pomocné funkce
│   └── middleware.ts            # Auth middleware
├── supabase/
│   └── schema.sql               # Databázové schéma
├── .env.local.example           # Šablona env proměnných
└── package.json
```

---

## 🔐 Role a oprávnění

- **employee** – vidí jen svá data, může podávat žádosti o absenci
- **admin** – vidí data všech, schvaluje/zamítá absence, spravuje role

První registrovaný uživatel se automaticky stane adminem.

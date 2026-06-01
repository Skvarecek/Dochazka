"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatDate, formatCurrency, entryTypeLabel, categoryLabel, calcDayPay } from "@/lib/utils";
import { Database, Download, Shield, AlertCircle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import * as XLSX from "xlsx";

export default function BackupPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [stats, setStats] = useState({ employees: 0, entries: 0, projects: 0, loans: 0, items: 0 });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
    if (p?.role !== "admin") { setLoading(false); return; }

    const [emp, ent, proj, loan, item] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("work_entries").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("loans").select("id", { count: "exact", head: true }),
      supabase.from("payroll_items").select("id", { count: "exact", head: true }),
    ]);
    setStats({
      employees: emp.count || 0, entries: ent.count || 0,
      projects: proj.count || 0, loans: loan.count || 0, items: item.count || 0,
    });

    const saved = localStorage.getItem("lastBackup");
    if (saved) setLastBackup(saved);
    setLoading(false);
  }

  async function downloadFullBackup() {
    setExporting(true);
    try {
      // Fetch everything
      const [profilesRes, entriesRes, projectsRes, loansRes, itemsRes, paidRes, locksRes] = await Promise.all([
        supabase.from("profiles").select("*").order("full_name"),
        supabase.from("work_entries").select("*, projects(name)").order("date", { ascending: false }),
        supabase.from("projects").select("*").order("name"),
        supabase.from("loans").select("*, profiles(full_name)").order("created_at", { ascending: false }),
        supabase.from("payroll_items").select("*, profiles(full_name)").order("month", { ascending: false }),
        supabase.from("payroll_paid").select("*, profiles(full_name)").order("month", { ascending: false }),
        supabase.from("monthly_locks").select("*").order("month", { ascending: false }),
      ]);

      const profiles = profilesRes.data || [];
      const entries = entriesRes.data || [];
      const projects = projectsRes.data || [];
      const loans = loansRes.data || [];
      const items = itemsRes.data || [];
      const paid = paidRes.data || [];
      const locks = locksRes.data || [];

      const wb = XLSX.utils.book_new();

      // Sheet 1: Zaměstnanci
      const empSheet = profiles.map(p => ({
        "Jméno": p.full_name, "E-mail": p.email, "Role": p.role,
        "Hodinová sazba": Number(p.hourly_rate), "Nemoc %": Number(p.sick_rate_percent),
        "Skrytý": p.is_hidden ? "Ano" : "Ne", "Vytvořeno": p.created_at,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(empSheet), "Zaměstnanci");

      // Sheet 2: Záznamy hodin
      const entriesSheet = entries.map((e: any) => {
        const emp = profiles.find((p: any) => p.id === e.user_id);
        return {
          "Datum": e.date, "Zaměstnanec": emp?.full_name || "?",
          "Typ": entryTypeLabel(e.entry_type), "Hodiny": Number(e.hours),
          "Zakázka": e.projects?.name || "", "Místo": e.location || "",
          "Poznámka": e.note || "", "Bonus %": Number(e.bonus_percent) || 100,
          "Uzamčeno": e.is_locked ? "Ano" : "Ne",
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entriesSheet), "Záznamy hodin");

      // Sheet 3: Zakázky
      const projSheet = projects.map(p => ({
        "Název": p.name, "Adresa": p.address || "", "Popis": p.description || "",
        "Aktivní": p.is_active ? "Ano" : "Ne", "Vytvořeno": p.created_at,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(projSheet), "Zakázky");

      // Sheet 4: Půjčky
      const loansSheet = loans.map((l: any) => ({
        "Zaměstnanec": l.profiles?.full_name || "?", "Částka": Number(l.amount),
        "Zbývá": Number(l.remaining), "Měsíční splátka": Number(l.monthly_deduction),
        "Popis": l.description || "", "Datum": l.date,
        "Splaceno": l.is_paid_off ? "Ano" : "Ne",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loansSheet), "Půjčky");

      // Sheet 5: Srážky a prémie
      const itemsSheet = items.map((i: any) => ({
        "Měsíc": i.month, "Zaměstnanec": i.profiles?.full_name || "?",
        "Typ": i.type === "deduction" ? "Srážka" : "Prémie",
        "Kategorie": categoryLabel(i.category), "Částka": Number(i.amount),
        "Popis": i.description || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(itemsSheet), "Srážky a prémie");

      // Sheet 6: Vyplacené výplaty
      const paidSheet = paid.map((p: any) => ({
        "Měsíc": p.month, "Zaměstnanec": p.profiles?.full_name || "?",
        "Vyplaceno": p.paid_at,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidSheet), "Vyplacené výplaty");

      // Sheet 7: Uzávěrky
      const locksSheet = locks.map((l: any) => ({ "Měsíc": l.month, "Uzamčeno": l.locked_at }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(locksSheet), "Uzávěrky");

      // Sheet 8: Souhrny výplat podle měsíců
      // Pro každý měsíc vypočítej celkové součty
      const months = Array.from(new Set(entries.map((e: any) => e.date.substring(0, 7)))).sort();
      const summaryRows: any[] = [];
      months.forEach((month: any) => {
        const monthEntries = entries.filter((e: any) => e.date.startsWith(month));
        profiles.forEach((emp: any) => {
          const myEntries = monthEntries.filter((e: any) => e.user_id === emp.id);
          if (myEntries.length === 0) return;
          let workH = 0, workPay = 0, vacPay = 0, sickPay = 0, holidayPay = 0;
          myEntries.forEach((e: any) => {
            const h = Number(e.hours); const bp = Number(e.bonus_percent) || 100;
            const pay = calcDayPay(e.entry_type, h, Number(emp.hourly_rate), Number(emp.sick_rate_percent), bp);
            if (e.entry_type === "work") { workH += h; workPay += pay; }
            else if (e.entry_type === "vacation") vacPay += pay;
            else if (e.entry_type === "sick") sickPay += pay;
            else if (e.entry_type === "holiday") holidayPay += pay;
          });
          summaryRows.push({
            "Měsíc": month, "Zaměstnanec": emp.full_name,
            "Odpracovaných hodin": workH, "Práce (Kč)": Math.round(workPay),
            "Dovolená (Kč)": Math.round(vacPay), "Nemoc (Kč)": Math.round(sickPay),
            "Svátek (Kč)": Math.round(holidayPay),
            "Hrubá mzda": Math.round(workPay + vacPay + sickPay + holidayPay),
          });
        });
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Souhrn po měsících");

      // Save file
      const fileName = `dochazka-zaloha-${format(new Date(), "yyyy-MM-dd-HHmm")}.xlsx`;
      XLSX.writeFile(wb, fileName);

      // Save backup timestamp
      const now = new Date().toISOString();
      localStorage.setItem("lastBackup", now);
      setLastBackup(now);
    } catch (e: any) {
      alert("Chyba při stahování zálohy: " + e.message);
    }
    setExporting(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  if (profile?.role !== "admin") return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl">Přístup odepřen</h2></div>;

  const daysSinceBackup = lastBackup ? Math.floor((Date.now() - new Date(lastBackup).getTime()) / (1000 * 60 * 60 * 24)) : null;
  const needsBackup = !lastBackup || (daysSinceBackup !== null && daysSinceBackup >= 7);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-ink-900">Zálohy dat</h2>
        <p className="text-ink-500 text-sm mt-1">Pro jistotu si občas stáhni zálohu všech dat jako Excel soubor</p>
      </div>

      {/* Backup status */}
      <div className={`card p-5 ${needsBackup ? "bg-amber-50/50 border-amber-200" : "bg-emerald-50/50 border-emerald-200"}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${needsBackup ? "bg-amber-100" : "bg-emerald-100"}`}>
            {needsBackup ? <AlertCircle className="w-6 h-6 text-amber-600" /> : <CheckCircle className="w-6 h-6 text-emerald-600" />}
          </div>
          <div className="flex-1">
            {lastBackup ? (
              <>
                <p className={`font-semibold ${needsBackup ? "text-amber-900" : "text-emerald-900"}`}>
                  Poslední záloha: {formatDate(lastBackup, "d. M. yyyy 'v' HH:mm")}
                </p>
                <p className={`text-sm ${needsBackup ? "text-amber-700" : "text-emerald-700"}`}>
                  {daysSinceBackup === 0 ? "Dnes" : daysSinceBackup === 1 ? "Před 1 dnem" : `Před ${daysSinceBackup} dny`}
                  {needsBackup && " – doporučujeme stáhnout novou zálohu"}
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-amber-900">Ještě jsi nestahoval žádnou zálohu</p>
                <p className="text-sm text-amber-700">Doporučujeme stáhnout zálohu hned</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card p-5">
        <h3 className="font-display font-semibold text-ink-900 mb-3">Co se zálohuje:</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div><p className="text-2xl font-display font-bold text-ink-900">{stats.employees}</p><p className="text-xs text-ink-500">Zaměstnanců</p></div>
          <div><p className="text-2xl font-display font-bold text-ink-900">{stats.entries}</p><p className="text-xs text-ink-500">Záznamů hodin</p></div>
          <div><p className="text-2xl font-display font-bold text-ink-900">{stats.projects}</p><p className="text-xs text-ink-500">Zakázek</p></div>
          <div><p className="text-2xl font-display font-bold text-ink-900">{stats.loans}</p><p className="text-xs text-ink-500">Půjček</p></div>
          <div><p className="text-2xl font-display font-bold text-ink-900">{stats.items}</p><p className="text-xs text-ink-500">Srážek/prémií</p></div>
        </div>
      </div>

      {/* Download button */}
      <div className="card p-6 text-center">
        <Database className="w-16 h-16 text-brand-400 mx-auto mb-4" />
        <h3 className="font-display font-bold text-lg mb-2">Stáhnout kompletní zálohu</h3>
        <p className="text-sm text-ink-500 mb-5">Vygeneruje Excel soubor se všemi daty v aplikaci – můžeš si ho uložit na USB nebo do cloudu</p>
        <button onClick={downloadFullBackup} disabled={exporting} className="btn-primary text-base px-8 py-3">
          <Download className="w-5 h-5" />
          {exporting ? "Vytvářím zálohu..." : "Stáhnout zálohu (Excel)"}
        </button>
      </div>

      {/* Info */}
      <div className="card p-5 bg-blue-50/30 border-blue-200">
        <h3 className="font-display font-semibold text-ink-900 mb-2">📌 Co dělat v případě problému?</h3>
        <ul className="text-sm text-ink-600 space-y-1.5 list-disc list-inside">
          <li>Supabase automaticky zálohuje databázi denně (dostupné 7 dní zpětně v Supabase dashboardu)</li>
          <li>Stahuj si zálohu Excelem minimálně 1× měsíčně – nejlépe po uzávěrce měsíce</li>
          <li>Ulož Excel na USB, do e-mailu nebo do cloudu (Dropbox, Google Drive)</li>
          <li>Pokud by appka vypadla, data máš v Excelu a lze je kdykoliv obnovit</li>
          <li>Pro pokročilou ochranu zvaž Supabase Pro plán (~25$/měsíc) s automatickými denními zálohami a point-in-time recovery</li>
        </ul>
      </div>
    </div>
  );
}

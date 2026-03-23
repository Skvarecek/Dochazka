"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatCurrency, calcDayPay, categoryLabel } from "@/lib/utils";
import { Wallet, Download, Lock, Unlock, ChevronLeft, ChevronRight, Users, Plus, Trash2, Copy } from "lucide-react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { cs } from "date-fns/locale";

export default function PayrollPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [employees, setEmployees] = useState<any[]>([]);
  const [entries, setEntries] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [payrollItems, setPayrollItems] = useState<any[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemUserId, setItemUserId] = useState("");
  const [itemType, setItemType] = useState("deduction");
  const [itemCategory, setItemCategory] = useState("advance");
  const [itemAmount, setItemAmount] = useState("");
  const [itemDesc, setItemDesc] = useState("");

  useEffect(() => { loadData(); }, [currentMonth]);

  async function loadData() {
    setLoading(true);
    const monthStr = format(currentMonth, "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    const [empRes, entriesRes, loansRes, itemsRes, locksRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("is_hidden", false).order("full_name"),
      supabase.from("work_entries").select("*").gte("date", monthStr).lte("date", monthEnd),
      supabase.from("loans").select("*").eq("is_paid_off", false),
      supabase.from("payroll_items").select("*").eq("month", monthStr),
      supabase.from("monthly_locks").select("*").eq("month", monthStr),
    ]);
    setEmployees(empRes.data || []);
    setEntries(entriesRes.data || []);
    setLoans(loansRes.data || []);
    setPayrollItems(itemsRes.data || []);
    setIsLocked((locksRes.data || []).length > 0);
    setLoading(false);
  }

  function calcRow(emp: any) {
    const myEntries = entries.filter(e => e.user_id === emp.id);
    const rate = Number(emp.hourly_rate) || 0;
    const sickPct = Number(emp.sick_rate_percent) || 60;
    let workPay = 0, vacPay = 0, sickPay = 0, workH = 0, vacD = 0, sickD = 0, dayOffD = 0;
    myEntries.forEach(e => {
      const h = Number(e.hours); const pay = calcDayPay(e.entry_type, h, rate, sickPct);
      if (e.entry_type === "work") { workH += h; workPay += pay; }
      else if (e.entry_type === "vacation") { vacD++; vacPay += pay; }
      else if (e.entry_type === "sick") { sickD++; sickPay += pay; }
      else { dayOffD++; }
    });
    const grossPay = workPay + vacPay + sickPay;
    const loanDed = loans.filter(l => l.user_id === emp.id).reduce((s, l) => s + Number(l.monthly_deduction), 0);
    const myItems = payrollItems.filter(i => i.user_id === emp.id);
    const deductions = myItems.filter(i => i.type === "deduction").reduce((s, i) => s + Number(i.amount), 0);
    const bonuses = myItems.filter(i => i.type === "bonus").reduce((s, i) => s + Number(i.amount), 0);
    const netPay = grossPay - loanDed - deductions + bonuses;
    return { workH, workPay, vacD, vacPay, sickD, sickPay, dayOffD, grossPay, loanDed, deductions, bonuses, netPay, items: myItems };
  }

  async function toggleLock() {
    const monthStr = format(currentMonth, "yyyy-MM-dd");
    const { data: { user } } = await supabase.auth.getUser();
    if (isLocked) { await supabase.from("monthly_locks").delete().eq("month", monthStr); }
    else {
      await supabase.from("monthly_locks").insert({ month: monthStr, locked_by: user?.id });
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      await supabase.from("work_entries").update({ is_locked: true }).gte("date", monthStr).lte("date", monthEnd);
    }
    loadData();
  }

  async function addPayrollItem() {
    if (!itemUserId || !itemAmount) return;
    const monthStr = format(currentMonth, "yyyy-MM-dd");
    await supabase.from("payroll_items").insert({ user_id: itemUserId, month: monthStr, type: itemType, category: itemCategory, amount: parseFloat(itemAmount), description: itemDesc || null });
    setShowAddItem(false); setItemAmount(""); setItemDesc(""); loadData();
  }

  async function deletePayrollItem(id: string) {
    await supabase.from("payroll_items").delete().eq("id", id); loadData();
  }

  async function copyFromLastMonth() {
    const prevMonth = format(subMonths(currentMonth, 1), "yyyy-MM-dd");
    const thisMonth = format(currentMonth, "yyyy-MM-dd");
    const { data: prevItems } = await supabase.from("payroll_items").select("*").eq("month", prevMonth);
    if (!prevItems || prevItems.length === 0) { alert("Minulý měsíc nemá žádné srážky/prémie."); return; }
    const newItems = prevItems.map((item: any) => ({
      user_id: item.user_id, month: thisMonth, type: item.type, category: item.category,
      amount: item.amount, description: item.description,
    }));
    await supabase.from("payroll_items").insert(newItems);
    loadData();
  }

  function exportCSV() {
    const headers = ["Zaměstnanec", "Práce (h)", "Práce (Kč)", "Dovolená (dní)", "Dovolená (Kč)", "Nemoc (dní)", "Nemoc (Kč)", "Hrubá mzda", "Splátky", "Srážky", "Prémie", "K výplatě"];
    const csvRows = employees.map(emp => {
      const r = calcRow(emp);
      return [emp.full_name, r.workH, r.workPay, r.vacD, r.vacPay, r.sickD, r.sickPay, r.grossPay, r.loanDed, r.deductions, r.bonuses, r.netPay].join(";");
    });
    const totalNet = employees.reduce((s, e) => s + calcRow(e).netPay, 0);
    csvRows.push(["", "", "", "", "", "", "", "", "", "", "CELKEM", totalNet].join(";"));
    const csv = "\uFEFF" + [headers.join(";"), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `vyplaty-${format(currentMonth, "yyyy-MM")}.csv`; a.click();
  }

  const totalGross = employees.reduce((s, e) => s + calcRow(e).grossPay, 0);
  const totalNet = employees.reduce((s, e) => s + calcRow(e).netPay, 0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-bold text-xl text-ink-900">{format(currentMonth, "LLLL yyyy", { locale: cs })}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowAddItem(!showAddItem)} className="btn-secondary"><Plus className="w-4 h-4" /> Srážka / Prémie</button>
          <button onClick={copyFromLastMonth} className="btn-secondary"><Copy className="w-4 h-4" /> Z minulého měsíce</button>
          <button onClick={exportCSV} className="btn-secondary"><Download className="w-4 h-4" /> CSV</button>
          <button onClick={toggleLock} className={isLocked ? "btn-danger" : "btn-primary"}>
            {isLocked ? <><Unlock className="w-4 h-4" /> Odemknout</> : <><Lock className="w-4 h-4" /> Uzavřít</>}
          </button>
        </div>
      </div>

      {showAddItem && (
        <div className="card p-6 animate-in">
          <h3 className="font-display font-semibold mb-4">Přidat srážku nebo prémii</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div><label className="label text-xs">Zaměstnanec</label><select className="input text-sm" value={itemUserId} onChange={e => setItemUserId(e.target.value)}><option value="">Vyberte</option>{employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
            <div><label className="label text-xs">Typ</label><select className="input text-sm" value={itemType} onChange={e => { setItemType(e.target.value); setItemCategory(e.target.value === "bonus" ? "premium" : "advance"); }}><option value="deduction">Srážka (−)</option><option value="bonus">Prémie (+)</option></select></div>
            <div><label className="label text-xs">Kategorie</label><select className="input text-sm" value={itemCategory} onChange={e => setItemCategory(e.target.value)}>
              {itemType === "deduction" ? <><option value="advance">Záloha</option><option value="insolvence">Insolvence</option><option value="insurance_health">Zdravotní</option><option value="insurance_social">Sociální</option><option value="internet">Internet</option><option value="other">Jiné</option></> : <option value="premium">Prémie / Odměna</option>}
            </select></div>
            <div><label className="label text-xs">Částka (Kč)</label><input type="number" className="input text-sm" value={itemAmount} onChange={e => setItemAmount(e.target.value)} /></div>
            <div><label className="label text-xs">Popis</label><input type="text" className="input text-sm" value={itemDesc} onChange={e => setItemDesc(e.target.value)} /></div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={addPayrollItem} className="btn-primary text-sm">Přidat</button><button onClick={() => setShowAddItem(false)} className="btn-secondary text-sm">Zrušit</button></div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div><span className="text-sm text-ink-500">Hrubé mzdy</span></div><p className="text-2xl font-display font-bold">{formatCurrency(totalGross)}</p></div>
        <div className="card p-5 ring-2 ring-brand-200"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><Wallet className="w-5 h-5 text-brand-600" /></div><span className="text-sm font-semibold text-brand-700">CELKEM K VÝPLATĚ</span></div><p className="text-3xl font-display font-bold text-brand-700">{formatCurrency(totalNet)}</p></div>
      </div>

      <div className="space-y-4">
        {employees.map(emp => {
          const r = calcRow(emp);
          return (
            <div key={emp.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center font-display font-semibold text-brand-700 text-xs">{emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</div>
                  <h3 className="font-semibold text-ink-900">{emp.full_name}</h3>
                  <span className="text-xs text-ink-400">{formatCurrency(Number(emp.hourly_rate))}/h</span>
                </div>
                <div className="text-right"><p className="text-xs text-ink-500">K výplatě</p><p className="text-xl font-display font-bold text-brand-700">{formatCurrency(r.netPay)}</p></div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                <div><span className="text-ink-400">Práce:</span> <span className="font-medium">{r.workH}h = {formatCurrency(r.workPay)}</span></div>
                <div><span className="text-ink-400">Dovolená:</span> <span className="font-medium">{r.vacD}d = {formatCurrency(r.vacPay)}</span></div>
                <div><span className="text-ink-400">Nemoc:</span> <span className="font-medium">{r.sickD}d = {formatCurrency(r.sickPay)}</span></div>
                <div><span className="text-ink-400">Hrubá mzda:</span> <span className="font-semibold">{formatCurrency(r.grossPay)}</span></div>
              </div>
              {(r.loanDed > 0 || r.items.length > 0) && (
                <div className="border-t border-surface-200 pt-2 space-y-1">
                  {r.loanDed > 0 && <div className="flex justify-between text-sm"><span className="text-ink-500">Splátky půjček</span><span className="text-red-600">−{formatCurrency(r.loanDed)}</span></div>}
                  {r.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-ink-500">{categoryLabel(item.category)}{item.description ? ` – ${item.description}` : ""}</span>
                      <div className="flex items-center gap-2">
                        <span className={item.type === "deduction" ? "text-red-600" : "text-emerald-600"}>{item.type === "deduction" ? "−" : "+"}{formatCurrency(item.amount)}</span>
                        <button onClick={() => deletePayrollItem(item.id)} className="text-ink-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatCurrency } from "@/lib/utils";
import { Shield, Save, Plus, Trash2, CreditCard, Banknote, UserPlus, X, Pencil, EyeOff, Eye, CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";

const DEFAULT_VACATION_DAYS = 21;

function fmtDays(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}

function draftOf(days: unknown): string {
  return days == null ? "" : String(Number(days));
}

export default function AdminPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [loanAmount, setLoanAmount] = useState("");
  const [loanDesc, setLoanDesc] = useState("");
  const [loanMonthly, setLoanMonthly] = useState("");
  const [showNewEmployee, setShowNewEmployee] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<any>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  // Dovolená: firemní výchozí nárok, vlastní nárok per zaměstnanec, čerpání za rok
  const [defaultVacation, setDefaultVacation] = useState(DEFAULT_VACATION_DAYS);
  const [defaultVacationInput, setDefaultVacationInput] = useState(String(DEFAULT_VACATION_DAYS));
  const [vacYear, setVacYear] = useState(new Date().getFullYear());
  const [vacUsed, setVacUsed] = useState<Record<string, number>>({});
  const [vacDraft, setVacDraft] = useState<Record<string, string>>({});
  const [vacSaving, setVacSaving] = useState<string | null>(null);
  const [vacMsg, setVacMsg] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (profile?.role === "admin") loadVacationUsed(vacYear); }, [vacYear, profile]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
    if (p?.role !== "admin") { setLoading(false); return; }
    const [empRes, loansRes, settingsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("loans").select("*, profiles(full_name)").eq("is_paid_off", false).order("created_at", { ascending: false }),
      supabase.from("app_settings").select("default_vacation_days").eq("id", 1).maybeSingle(),
    ]);
    const emps = empRes.data || [];
    setEmployees(emps);
    setLoans(loansRes.data || []);
    const dv = settingsRes.data?.default_vacation_days != null ? Number(settingsRes.data.default_vacation_days) : DEFAULT_VACATION_DAYS;
    setDefaultVacation(dv);
    setDefaultVacationInput(String(dv));
    setVacDraft(Object.fromEntries(emps.map((e: any) => [e.id, draftOf(e.vacation_days)])));
    setLoading(false);
  }

  async function loadVacationUsed(year: number) {
    const { data } = await supabase.from("work_entries").select("user_id")
      .eq("entry_type", "vacation").gte("date", `${year}-01-01`).lte("date", `${year}-12-31`);
    const used: Record<string, number> = {};
    (data || []).forEach((e: any) => { used[e.user_id] = (used[e.user_id] || 0) + 1; });
    setVacUsed(used);
  }

  async function saveDefaultVacation() {
    const v = parseFloat(defaultVacationInput.replace(",", "."));
    if (isNaN(v) || v < 0 || v > 365) { setVacMsg("Výchozí nárok musí být číslo 0–365."); return; }
    setVacSaving("default"); setVacMsg(null);
    const { error } = await supabase.from("app_settings").upsert({ id: 1, default_vacation_days: v });
    setVacSaving(null);
    if (error) { setVacMsg(`Uložení se nezdařilo: ${error.message}`); return; }
    setDefaultVacation(v);
  }

  async function saveEmployeeVacation(empId: string) {
    const raw = (vacDraft[empId] ?? "").trim().replace(",", ".");
    const value = raw === "" ? null : parseFloat(raw);
    if (value !== null && (isNaN(value) || value < 0 || value > 365)) { setVacMsg("Nárok musí být číslo 0–365 (prázdné = výchozí)."); return; }
    setVacSaving(empId); setVacMsg(null);
    const { error } = await supabase.from("profiles").update({ vacation_days: value }).eq("id", empId);
    setVacSaving(null);
    if (error) { setVacMsg(`Uložení se nezdařilo: ${error.message}`); return; }
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, vacation_days: value } : e));
  }

  async function saveRates(emp: any) {
    setSaving(emp.id);
    await supabase.from("profiles").update({ hourly_rate: emp.hourly_rate, sick_rate_percent: emp.sick_rate_percent }).eq("id", emp.id);
    setSaving(null);
  }

  async function saveName(id: string) {
    if (!editNameValue.trim()) return;
    await supabase.from("profiles").update({ full_name: editNameValue.trim() }).eq("id", id);
    setEditingName(null); loadData();
  }

  async function toggleRole(id: string, cur: string) {
    await supabase.from("profiles").update({ role: cur === "admin" ? "employee" : "admin" }).eq("id", id);
    loadData();
  }

  async function toggleHidden(id: string, cur: boolean) {
    await supabase.from("profiles").update({ is_hidden: !cur }).eq("id", id);
    loadData();
  }

  async function deleteEmployee(id: string, name: string) {
    if (!confirm(`Opravdu odebrat zaměstnance "${name}"?\n\nTím se smažou i všechny jeho záznamy hodin, půjčky a srážky. Tato akce je nevratná!`)) return;
    // Delete in order: payroll_items, loans, work_entries, then profile
    await supabase.from("payroll_items").delete().eq("user_id", id);
    await supabase.from("loans").delete().eq("user_id", id);
    await supabase.from("work_entries").delete().eq("user_id", id);
    await supabase.from("profiles").delete().eq("id", id);
    loadData();
  }

  async function createEmployee() {
    setCreating(true); setCreateMsg(null);
    const email = newEmail.trim() || `${newName.trim().toLowerCase().replace(/\s+/g, ".")}@inex-cz.local`;
    const password = newPassword.trim() || "heslo123";
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: newName.trim() } } });
    if (error) { setCreateMsg({ type: "err", text: error.message }); setCreating(false); return; }
    await new Promise(r => setTimeout(r, 1500));
    if (data.user) await supabase.from("profiles").update({ full_name: newName.trim(), role: "employee" }).eq("id", data.user.id);
    setCreateMsg({ type: "ok", text: `Vytvořen: ${newName.trim()} — přihlášení: ${email} / ${password}` });
    setNewName(""); setNewEmail(""); setNewPassword(""); setCreating(false); loadData();
  }

  async function addLoan() {
    if (!activeEmployee || !loanAmount) return;
    await supabase.from("loans").insert({ user_id: activeEmployee, amount: parseFloat(loanAmount), remaining: parseFloat(loanAmount), description: loanDesc || null, monthly_deduction: parseFloat(loanMonthly) || 0 });
    setLoanAmount(""); setLoanDesc(""); setLoanMonthly(""); setShowLoanForm(false); loadData();
  }

  async function deleteLoan(id: string) { if (!confirm("Smazat půjčku?")) return; await supabase.from("loans").delete().eq("id", id); loadData(); }

  function updateField(id: string, field: string, value: string) {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: parseFloat(value) || 0 } : e));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  if (profile?.role !== "admin") return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl mb-2">Přístup odepřen</h2></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-ink-900">Zaměstnanci</h2>
        <button onClick={() => setShowNewEmployee(!showNewEmployee)} className="btn-primary">
          {showNewEmployee ? <><X className="w-4 h-4" /> Zrušit</> : <><UserPlus className="w-4 h-4" /> Přidat zaměstnance</>}
        </button>
      </div>

      {showNewEmployee && (
        <div className="card p-6 animate-in">
          <h3 className="font-display font-semibold text-lg mb-4">Nový zaměstnanec</h3>
          {createMsg && <div className={`mb-4 p-3 rounded-xl text-sm ${createMsg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>{createMsg.text}</div>}
          <div className="space-y-4">
            <div><label className="label">Celé jméno *</label><input type="text" className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Jan Novák" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">E-mail (volitelné)</label><input type="email" className="input" value={newEmail} onChange={e => setNewEmail(e.target.value)} /><p className="text-xs text-ink-400 mt-1">Prázdné = jmeno@inex-cz.local</p></div>
              <div><label className="label">Heslo</label><input type="text" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="heslo123" /></div>
            </div>
            <button onClick={createEmployee} disabled={creating || !newName.trim()} className="btn-primary">{creating ? "Vytvářím..." : <><UserPlus className="w-4 h-4" /> Vytvořit</>}</button>
          </div>
        </div>
      )}

      {/* Dovolená — nárok a čerpání */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CalendarCheck className="w-5 h-5 text-emerald-600" /></div>
            <div>
              <h3 className="font-display font-semibold text-ink-900">Dovolená</h3>
              <p className="text-xs text-ink-500">Čerpáno = zapsané dny dovolené v roce {vacYear}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setVacYear(vacYear - 1)} className="btn-secondary p-1.5" title="Předchozí rok"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-display font-semibold w-14 text-center">{vacYear}</span>
            <button onClick={() => setVacYear(vacYear + 1)} className="btn-secondary p-1.5" title="Další rok"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-surface-50 border border-surface-200 mb-3">
          <label className="text-sm font-medium text-ink-700" htmlFor="defaultVacation">Výchozí nárok pro všechny:</label>
          <input id="defaultVacation" type="number" className="input w-24 text-sm py-1.5" value={defaultVacationInput}
            onChange={e => setDefaultVacationInput(e.target.value)} min="0" max="365" step="0.5" />
          <span className="text-sm text-ink-500">dní</span>
          {defaultVacationInput !== String(defaultVacation) && (
            <button onClick={saveDefaultVacation} disabled={vacSaving === "default"} className="btn-primary text-xs px-3 py-1.5">
              <Save className="w-3.5 h-3.5" /> {vacSaving === "default" ? "..." : "Uložit"}
            </button>
          )}
          <p className="w-full text-xs text-ink-400">Platí pro každého, kdo nemá vyplněný vlastní nárok.</p>
        </div>

        {vacMsg && <div className="mb-3 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200">{vacMsg}</div>}

        <div className="divide-y divide-surface-100">
          {employees.filter(e => !e.is_hidden).map(emp => {
            const custom = emp.vacation_days != null;
            const allowance = custom ? Number(emp.vacation_days) : defaultVacation;
            const used = vacUsed[emp.id] || 0;
            const remaining = allowance - used;
            const pct = allowance > 0 ? Math.min(100, (used / allowance) * 100) : (used > 0 ? 100 : 0);
            const draft = vacDraft[emp.id] ?? draftOf(emp.vacation_days);
            const dirty = draft !== draftOf(emp.vacation_days);
            return (
              <div key={emp.id} className="py-3 flex items-center gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-[140px]">
                  <p className="text-sm font-medium text-ink-900 truncate">{emp.full_name}</p>
                  <div className="h-1.5 rounded-full bg-surface-200 mt-1.5 overflow-hidden">
                    <div className={`h-full rounded-full ${remaining < 0 ? "bg-red-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="text-center w-16">
                  <p className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider">Čerpáno</p>
                  <p className="font-mono text-sm text-ink-900">{fmtDays(used)}</p>
                </div>
                <div className="w-32">
                  <p className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider text-center">Nárok</p>
                  <div className="flex items-center justify-center gap-1">
                    <input type="number" className="input text-sm py-1 px-2 w-16 text-center" value={draft}
                      placeholder={fmtDays(defaultVacation)} title="Prázdné = výchozí nárok"
                      onChange={e => setVacDraft(prev => ({ ...prev, [emp.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === "Enter" && dirty) saveEmployeeVacation(emp.id); }}
                      min="0" max="365" step="0.5" />
                    {dirty && (
                      <button onClick={() => saveEmployeeVacation(emp.id)} disabled={vacSaving === emp.id} className="btn-primary text-xs px-1.5 py-1" title="Uložit nárok">
                        <Save className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-ink-400 text-center mt-0.5">{custom ? "vlastní" : "výchozí"}</p>
                </div>
                <div className="text-center w-16">
                  <p className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider">Zbývá</p>
                  <p className={`font-display font-bold text-lg ${remaining < 0 ? "text-red-600" : remaining <= 3 ? "text-amber-600" : "text-emerald-700"}`}>{fmtDays(remaining)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        {employees.map(emp => (
          <div key={emp.id} className={`card p-5 ${emp.is_hidden ? "opacity-60 border-dashed" : ""}`}>
            <div className="flex items-center gap-4 mb-4 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center font-display font-semibold text-brand-700 text-sm">{emp.full_name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}</div>
              <div className="flex-1 min-w-[150px]">
                {editingName === emp.id ? (
                  <div className="flex items-center gap-2">
                    <input type="text" className="input text-sm py-1" value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveName(emp.id); if (e.key === "Escape") setEditingName(null); }} autoFocus />
                    <button onClick={() => saveName(emp.id)} className="btn-primary text-xs px-2 py-1"><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingName(null)} className="btn-secondary text-xs px-2 py-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-ink-900">{emp.full_name}</p>
                    <button onClick={() => { setEditingName(emp.id); setEditNameValue(emp.full_name); }} className="text-ink-300 hover:text-ink-600"><Pencil className="w-3.5 h-3.5" /></button>
                  </div>
                )}
                <p className="text-xs text-ink-500">{emp.email}</p>
              </div>
              {emp.is_hidden && <span className="badge bg-surface-200 text-ink-500">Skrytý</span>}
              <span className={`badge ${emp.role === "admin" ? "bg-brand-100 text-brand-700" : "bg-surface-100 text-ink-500"}`}>{emp.role === "admin" ? "Admin" : "Zaměstnanec"}</span>
              <div className="flex gap-1">
                <button onClick={() => toggleHidden(emp.id, emp.is_hidden)} className="btn-secondary text-xs px-2 py-1.5" title={emp.is_hidden ? "Zobrazit" : "Skrýt"}>
                  {emp.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
                {emp.id !== profile?.id && <button onClick={() => toggleRole(emp.id, emp.role)} className="btn-secondary text-xs px-3 py-1.5">{emp.role === "admin" ? "Odebrat admina" : "Nastavit admina"}</button>}
                {emp.id !== profile?.id && <button onClick={() => deleteEmployee(emp.id, emp.full_name)} className="btn-secondary text-xs px-2 py-1.5 hover:text-red-500 hover:border-red-200" title="Odebrat zaměstnance"><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            </div>
            {!emp.is_hidden && <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="label text-xs">Hodinová sazba (Kč/h)</label><input type="number" className="input text-sm" value={emp.hourly_rate} onChange={e => updateField(emp.id, "hourly_rate", e.target.value)} /></div>
                <div><label className="label text-xs">Nemoc (% z denní sazby)</label><input type="number" className="input text-sm" value={emp.sick_rate_percent} onChange={e => updateField(emp.id, "sick_rate_percent", e.target.value)} min="0" max="100" /></div>
                <div className="flex items-end"><p className="text-xs text-ink-400 pb-2">Dovolená = 8h × sazba<br />Nemoc = 8h × sazba × {emp.sick_rate_percent}%</p></div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button onClick={() => saveRates(emp)} disabled={saving === emp.id} className="btn-primary text-sm"><Save className="w-4 h-4" /> {saving === emp.id ? "..." : "Uložit sazby"}</button>
                <button onClick={() => { setActiveEmployee(emp.id); setShowLoanForm(true); }} className="btn-secondary text-sm"><Banknote className="w-4 h-4" /> Přidat půjčku</button>
              </div>
              {loans.filter(l => l.user_id === emp.id).length > 0 && (
                <div className="mt-4 border-t border-surface-200 pt-3">
                  <p className="text-xs font-semibold text-ink-500 mb-2">Aktivní půjčky:</p>
                  {loans.filter(l => l.user_id === emp.id).map(loan => (
                    <div key={loan.id} className="flex items-center gap-3 py-1.5 text-sm flex-wrap">
                      <CreditCard className="w-4 h-4 text-ink-300" /><span className="text-ink-700">{loan.description || "Půjčka"}</span>
                      <span className="font-medium">{formatCurrency(loan.amount)}</span><span className="text-ink-500">zbývá {formatCurrency(loan.remaining)}</span>
                      {loan.monthly_deduction > 0 && <span className="text-ink-400">({formatCurrency(loan.monthly_deduction)}/měs.)</span>}
                      <button onClick={() => deleteLoan(loan.id)} className="ml-auto text-ink-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              )}
            </>}
          </div>
        ))}
      </div>

      {showLoanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setShowLoanForm(false)}>
          <div className="card p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-display font-semibold text-lg mb-4">Nová půjčka</h3>
            <p className="text-sm text-ink-500 mb-4">Pro: {employees.find(e => e.id === activeEmployee)?.full_name}</p>
            <div className="space-y-3">
              <div><label className="label">Částka (Kč)</label><input type="number" className="input" value={loanAmount} onChange={e => setLoanAmount(e.target.value)} /></div>
              <div><label className="label">Popis</label><input type="text" className="input" value={loanDesc} onChange={e => setLoanDesc(e.target.value)} /></div>
              <div><label className="label">Měsíční splátka (Kč)</label><input type="number" className="input" value={loanMonthly} onChange={e => setLoanMonthly(e.target.value)} /></div>
              <div className="flex gap-3"><button onClick={addLoan} className="btn-primary flex-1">Přidat</button><button onClick={() => setShowLoanForm(false)} className="btn-secondary">Zrušit</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

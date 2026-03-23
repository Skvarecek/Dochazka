"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatDate, entryTypeLabel, entryTypeColor } from "@/lib/utils";
import { Plus, X, Trash2, Clock, ChevronLeft, ChevronRight, Pencil, Save, Users, AlertTriangle } from "lucide-react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format } from "date-fns";
import { cs } from "date-fns/locale";

export default function HoursPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formHours, setFormHours] = useState("8");
  const [formType, setFormType] = useState("work");
  const [formProject, setFormProject] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formUserId, setFormUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedUserId) loadEntries(); }, [currentMonth, selectedUserId]);

  async function loadInitial() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p); setSelectedUserId(user.id); setFormUserId(user.id);
    const projRes = await supabase.from("projects").select("*").eq("is_active", true).order("name");
    setProjects(projRes.data || []);
    if (p?.role === "admin") {
      const empRes = await supabase.from("profiles").select("*").eq("is_hidden", false).order("full_name");
      setEmployees(empRes.data || []);
    }
  }

  async function loadEntries() {
    setLoading(true);
    const monthStart = startOfMonth(currentMonth).toISOString().split("T")[0];
    const monthEnd = endOfMonth(currentMonth).toISOString().split("T")[0];
    const [entriesRes, locksRes] = await Promise.all([
      supabase.from("work_entries").select("*, projects(name)").eq("user_id", selectedUserId).gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false }),
      supabase.from("monthly_locks").select("*").eq("month", monthStart),
    ]);
    setEntries(entriesRes.data || []);
    setIsLocked((locksRes.data || []).length > 0);
    setLoading(false);
  }

  async function handleSubmit(e: any) {
    e.preventDefault(); setSubmitting(true); setSubmitError("");
    const targetUserId = profile?.role === "admin" ? formUserId : selectedUserId;

    // Check if entry exists for this day
    const { data: existing } = await supabase.from("work_entries").select("id").eq("user_id", targetUserId).eq("date", formDate).single();
    if (existing) {
      setSubmitError("Na tento den už existuje záznam. Upravte existující záznam místo vytváření nového.");
      setSubmitting(false); return;
    }

    const { error } = await supabase.from("work_entries").insert({
      user_id: targetUserId, date: formDate, hours: parseFloat(formHours),
      entry_type: formType, project_id: formProject || null, location: formLocation || null, note: formNote || null,
    });
    if (error) { setSubmitError(error.message); }
    else { setShowForm(false); setFormHours("8"); setFormType("work"); setFormProject(""); setFormLocation(""); setFormNote(""); loadEntries(); }
    setSubmitting(false);
  }

  async function handleDelete(id: string) { if (!confirm("Smazat?")) return; await supabase.from("work_entries").delete().eq("id", id); loadEntries(); }

  async function handleEditSave(id: string) {
    await supabase.from("work_entries").update({ hours: parseFloat(editHours), note: editNote || null }).eq("id", id);
    setEditingId(null); loadEntries();
  }

  const isAdmin = profile?.role === "admin";
  const canEdit = isAdmin || !isLocked;
  const totalWork = entries.filter(e => e.entry_type === "work").reduce((s, e) => s + Number(e.hours), 0);
  const totalOther = entries.filter(e => e.entry_type !== "work").reduce((s, e) => s + Number(e.hours), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-bold text-xl text-ink-900">{format(currentMonth, "LLLL yyyy", { locale: cs })}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        {canEdit && <button onClick={() => { setShowForm(!showForm); setSubmitError(""); }} className="btn-primary">{showForm ? <><X className="w-4 h-4" /> Zrušit</> : <><Plus className="w-4 h-4" /> Zapsat hodiny</>}</button>}
        {isLocked && !isAdmin && <span className="badge bg-red-100 text-red-700">Uzavřeno</span>}
      </div>

      {isAdmin && employees.length > 0 && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <Users className="w-5 h-5 text-ink-400" />
          <label className="text-sm font-medium text-ink-700">Zaměstnanec:</label>
          <select className="input w-auto" value={selectedUserId || ""} onChange={e => { setSelectedUserId(e.target.value); setFormUserId(e.target.value); }}>
            {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-600" /></div><div><p className="text-xs text-ink-500">Práce</p><p className="text-xl font-display font-bold text-ink-900">{totalWork} h</p></div></div>
        <div className="card p-4 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div><div><p className="text-xs text-ink-500">Ostatní</p><p className="text-xl font-display font-bold text-ink-900">{totalOther} h</p></div></div>
      </div>

      {showForm && (
        <div className="card p-6 animate-in">
          <h3 className="font-display font-semibold text-lg mb-4">Nový záznam</h3>
          {submitError && <div className="mb-4 p-3 rounded-xl text-sm bg-red-50 text-red-700 border border-red-200 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{submitError}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isAdmin && <div><label className="label">Zaměstnanec</label><select className="input" value={formUserId} onChange={e => setFormUserId(e.target.value)}>{employees.map(emp => <option key={emp.id} value={emp.id}>{emp.full_name}</option>)}</select></div>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="label">Datum</label><input type="date" className="input" value={formDate} onChange={e => setFormDate(e.target.value)} required /></div>
              <div><label className="label">Hodiny</label><input type="number" className="input" value={formHours} onChange={e => setFormHours(e.target.value)} min="0.5" max="24" step="0.5" required /></div>
              <div><label className="label">Typ</label><select className="input" value={formType} onChange={e => setFormType(e.target.value)}><option value="work">Práce</option><option value="vacation">Dovolená</option><option value="sick">Nemoc</option><option value="day_off">Volno</option></select></div>
            </div>
            {formType === "work" && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Zakázka</label><select className="input" value={formProject} onChange={e => setFormProject(e.target.value)}><option value="">--</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.address ? ` (${p.address})` : ""}</option>)}</select></div>
              <div><label className="label">Místo</label><input type="text" className="input" value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
            </div>}
            <div><label className="label">Poznámka</label><textarea className="input min-h-[60px] resize-y" value={formNote} onChange={e => setFormNote(e.target.value)} /></div>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? "Ukládání..." : "Uložit"}</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200"><h3 className="font-display font-semibold text-ink-900">Záznamy</h3></div>
        {loading ? <div className="px-6 py-8 text-center text-ink-500">Načítání...</div> : entries.length === 0 ? <div className="px-6 py-12 text-center text-ink-500">Žádné záznamy</div> : (
          <div className="divide-y divide-surface-100">
            {entries.map(entry => (
              <div key={entry.id} className="px-6 py-3">
                {editingId === entry.id ? (
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-20 text-xs text-ink-500">{formatDate(entry.date, "EEE d.M.")}</div>
                    <span className={`badge ${entryTypeColor(entry.entry_type)}`}>{entryTypeLabel(entry.entry_type)}</span>
                    <input type="number" className="input w-20 text-sm py-1" value={editHours} onChange={e => setEditHours(e.target.value)} min="0.5" max="24" step="0.5" />
                    <input type="text" className="input flex-1 text-sm py-1" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Poznámka..." />
                    <button onClick={() => handleEditSave(entry.id)} className="btn-primary text-xs px-2 py-1"><Save className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary text-xs px-2 py-1"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-xs text-ink-500 flex-shrink-0">{formatDate(entry.date, "EEE d.M.")}</div>
                    <span className={`badge flex-shrink-0 ${entryTypeColor(entry.entry_type)}`}>{entryTypeLabel(entry.entry_type)}</span>
                    <div className="flex-1 min-w-0 text-sm truncate">
                      {entry.projects?.name && <span className="font-medium text-ink-900">{entry.projects.name}</span>}
                      {entry.location && <span className="text-ink-400"> · {entry.location}</span>}
                      {entry.note && <span className="text-ink-500"> – {entry.note}</span>}
                    </div>
                    <div className="font-mono text-sm font-medium text-ink-900 flex-shrink-0">{Number(entry.hours)} h</div>
                    {(isAdmin || (!entry.is_locked && !isLocked)) && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => { setEditingId(entry.id); setEditHours(String(entry.hours)); setEditNote(entry.note || ""); }} className="text-ink-300 hover:text-brand-600"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(entry.id)} className="text-ink-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

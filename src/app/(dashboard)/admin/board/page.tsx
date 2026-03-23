"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { entryTypeShort } from "@/lib/utils";
import { ChevronLeft, ChevronRight, X, Save, Filter, Eye, EyeOff } from "lucide-react";
import { startOfMonth, endOfMonth, addMonths, subMonths, format, eachDayOfInterval, isWeekend, isSameDay } from "date-fns";
import { cs } from "date-fns/locale";

export default function BoardPage() {
  const supabase = createClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [entries, setEntries] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilter, setShowFilter] = useState(false);

  // Edit modal
  const [editing, setEditing] = useState<{ userId: string; date: string; entry?: any } | null>(null);
  const [formHours, setFormHours] = useState("8");
  const [formType, setFormType] = useState("work");
  const [formProject, setFormProject] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formNote, setFormNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [currentMonth]);

  async function loadData() {
    setLoading(true);
    const monthStart = startOfMonth(currentMonth).toISOString().split("T")[0];
    const monthEnd = endOfMonth(currentMonth).toISOString().split("T")[0];

    const [empRes, entriesRes, projRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("work_entries").select("*, projects(name)").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("projects").select("*").eq("is_active", true).order("name"),
    ]);

    const emps = empRes.data || [];
    setAllEmployees(emps);
    // Auto-hide those marked is_hidden in DB
    const autoHidden = new Set(emps.filter((e: any) => e.is_hidden).map((e: any) => e.id));
    setHiddenIds(prev => {
      // Keep user's manual choices, but also include DB-hidden
      const merged = new Set(autoHidden);
      prev.forEach(id => merged.add(id));
      return merged;
    });
    setEntries(entriesRes.data || []);
    setProjects(projRes.data || []);
    setLoading(false);
  }

  function toggleEmployeeVisibility(id: string) {
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const employees = allEmployees.filter(e => !hiddenIds.has(e.id));
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const today = new Date();

  function getEntry(userId: string, date: string) {
    return entries.find(e => e.user_id === userId && e.date === date);
  }

  function openCell(userId: string, date: string) {
    const entry = getEntry(userId, date);
    if (entry) {
      setFormHours(String(Number(entry.hours)));
      setFormType(entry.entry_type);
      setFormProject(entry.project_id || "");
      setFormLocation(entry.location || "");
      setFormNote(entry.note || "");
    } else {
      setFormHours("8"); setFormType("work"); setFormProject(""); setFormLocation(""); setFormNote("");
    }
    setEditing({ userId, date, entry });
  }

  async function saveEntry() {
    if (!editing) return;
    setSaving(true);
    const data = {
      user_id: editing.userId, date: editing.date,
      hours: parseFloat(formHours), entry_type: formType,
      project_id: formProject || null, location: formLocation || null, note: formNote || null,
    };
    if (editing.entry) await supabase.from("work_entries").update(data).eq("id", editing.entry.id);
    else await supabase.from("work_entries").insert(data);
    setSaving(false); setEditing(null); loadData();
  }

  async function deleteEntry() {
    if (!editing?.entry || !confirm("Smazat záznam?")) return;
    await supabase.from("work_entries").delete().eq("id", editing.entry.id);
    setEditing(null); loadData();
  }

  function cellContent(entry: any) {
    if (!entry) return { hours: "", location: "", cls: "text-ink-200 hover:bg-brand-50/50 cursor-pointer" };
    const short = entryTypeShort(entry.entry_type);
    if (short) return {
      hours: short, location: "",
      cls: entry.entry_type === "vacation" ? "text-emerald-600 font-semibold cursor-pointer hover:bg-emerald-50" :
           entry.entry_type === "sick" ? "text-amber-600 font-semibold cursor-pointer hover:bg-amber-50" :
           "text-purple-600 font-semibold cursor-pointer hover:bg-purple-50",
    };
    return { hours: String(Number(entry.hours)), location: entry.projects?.name || entry.location || "", cls: "cursor-pointer hover:bg-blue-50" };
  }

  const empName = (id: string) => allEmployees.find(e => e.id === id)?.full_name || "";
  const hiddenCount = hiddenIds.size;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronLeft className="w-5 h-5" /></button>
          <h2 className="font-display font-bold text-xl text-ink-900">{format(currentMonth, "LLLL yyyy", { locale: cs })}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="btn-secondary p-2"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-ink-400">Klikni na buňku pro zápis</p>
          <button onClick={() => setShowFilter(!showFilter)} className="btn-secondary text-sm">
            <Filter className="w-4 h-4" />
            Zaměstnanci
            {hiddenCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{hiddenCount} skryto</span>}
          </button>
        </div>
      </div>

      {/* Employee filter panel */}
      {showFilter && (
        <div className="card p-4 animate-in">
          <p className="text-sm font-medium text-ink-700 mb-3">Zobrazit/skrýt zaměstnance v nástěnce:</p>
          <div className="flex flex-wrap gap-2">
            {allEmployees.map(emp => {
              const isVisible = !hiddenIds.has(emp.id);
              return (
                <button key={emp.id} onClick={() => toggleEmployeeVisibility(emp.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                    isVisible
                      ? "bg-brand-50 border-brand-300 text-brand-700"
                      : "bg-surface-100 border-surface-200 text-ink-400 line-through"
                  }`}>
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {emp.full_name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {employees.length === 0 ? (
        <div className="card px-6 py-12 text-center text-ink-500">Žádní viditelní zaměstnanci. Klikněte na "Zaměstnanci" pro zobrazení.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-collapse w-full" style={{ minWidth: `${200 + employees.length * 140}px` }}>
              <thead>
                <tr className="bg-surface-50 border-b-2 border-surface-300">
                  <th className="sticky left-0 z-10 bg-surface-50 px-2 py-2 text-left font-semibold text-ink-700 border-r border-surface-200 w-24">Datum</th>
                  {employees.map(emp => (
                    <th key={emp.id} className="px-1 py-2 text-center border-r border-surface-200">
                      <div className="font-semibold text-ink-900 text-[11px]">{emp.full_name.split(" ").slice(-1)[0]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const weekend = isWeekend(day);
                  const isToday = isSameDay(day, today);
                  return (
                    <tr key={dateStr} className={`${weekend ? "bg-surface-100/60" : ""} ${isToday ? "bg-brand-50/40" : ""} border-b border-surface-100`}>
                      <td className={`sticky left-0 z-10 px-2 py-1.5 border-r border-surface-200 whitespace-nowrap ${weekend ? "bg-surface-100/60" : "bg-white"} ${isToday ? "bg-brand-50/40 font-semibold text-brand-700" : "text-ink-500"}`}>
                        <span className="text-ink-400 w-6 inline-block">{format(day, "EEEEEE", { locale: cs })}</span>{format(day, "d.M.")}
                      </td>
                      {employees.map(emp => {
                        const entry = getEntry(emp.id, dateStr);
                        const cell = cellContent(entry);
                        return (
                          <td key={emp.id} onClick={() => openCell(emp.id, dateStr)} className={`px-1 py-1.5 border-r border-surface-100 text-center transition-colors ${cell.cls}`}>
                            {cell.hours ? (
                              <div className="leading-tight">
                                <span className="font-semibold">{cell.hours}</span>
                                {cell.location && <div className="text-ink-400 text-[9px] truncate max-w-[100px] mx-auto">{cell.location}</div>}
                              </div>
                            ) : <span className="text-ink-200">·</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="bg-surface-50 border-t-2 border-surface-300 font-semibold">
                  <td className="sticky left-0 z-10 bg-surface-50 px-2 py-2 border-r border-surface-200 text-ink-700">Celkem</td>
                  {employees.map(emp => {
                    const empEntries = entries.filter(e => e.user_id === emp.id);
                    const workH = empEntries.filter(e => e.entry_type === "work").reduce((s, e) => s + Number(e.hours), 0);
                    const vacD = empEntries.filter(e => e.entry_type === "vacation").length;
                    const sickD = empEntries.filter(e => e.entry_type === "sick").length;
                    return (
                      <td key={emp.id} className="px-1 py-2 text-center border-r border-surface-100">
                        <div className="text-ink-900">{workH}h</div>
                        {vacD > 0 && <div className="text-emerald-600 text-[10px]">{vacD}× D</div>}
                        {sickD > 0 && <div className="text-amber-600 text-[10px]">{sickD}× N</div>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <div className="card p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">
                {empName(editing.userId)} – {format(new Date(editing.date), "EEEE d.M.", { locale: cs })}
              </h3>
              <button onClick={() => setEditing(null)} className="text-ink-400 hover:text-ink-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label text-xs">Hodiny</label><input type="number" className="input" value={formHours} onChange={e => setFormHours(e.target.value)} min="0.5" max="24" step="0.5" /></div>
                <div><label className="label text-xs">Typ</label><select className="input" value={formType} onChange={e => setFormType(e.target.value)}>
                  <option value="work">Práce</option><option value="vacation">Dovolená</option><option value="sick">Nemoc</option><option value="day_off">Volno</option>
                </select></div>
              </div>
              {formType === "work" && <>
                <div><label className="label text-xs">Zakázka</label><select className="input" value={formProject} onChange={e => setFormProject(e.target.value)}>
                  <option value="">--</option>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
                <div><label className="label text-xs">Místo</label><input type="text" className="input" value={formLocation} onChange={e => setFormLocation(e.target.value)} /></div>
              </>}
              <div><label className="label text-xs">Poznámka</label><input type="text" className="input" value={formNote} onChange={e => setFormNote(e.target.value)} /></div>
              <div className="flex gap-2">
                <button onClick={saveEntry} disabled={saving} className="btn-primary flex-1"><Save className="w-4 h-4" /> {saving ? "..." : "Uložit"}</button>
                {editing.entry && <button onClick={deleteEntry} className="btn-danger">Smazat</button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

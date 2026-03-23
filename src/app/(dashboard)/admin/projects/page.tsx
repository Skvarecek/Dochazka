"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatCurrency } from "@/lib/utils";
import { Plus, X, Building2, MapPin, Trash2, Eye, EyeOff, Pencil, Save } from "lucide-react";

export default function ProjectsPage() {
  const supabase = createClient();
  const [projects, setProjects] = useState<any[]>([]);
  const [projectStats, setProjectStats] = useState<Record<string, { hours: number; cost: number }>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [projRes, entriesRes, profilesRes] = await Promise.all([
      supabase.from("projects").select("*").order("is_active", { ascending: false }).order("name"),
      supabase.from("work_entries").select("project_id, hours, user_id, entry_type").eq("entry_type", "work").not("project_id", "is", null),
      supabase.from("profiles").select("id, hourly_rate"),
    ]);
    setProjects(projRes.data || []);
    const rates: Record<string, number> = {};
    (profilesRes.data || []).forEach((p: any) => { rates[p.id] = Number(p.hourly_rate) || 0; });
    const stats: Record<string, { hours: number; cost: number }> = {};
    (entriesRes.data || []).forEach((e: any) => {
      if (!stats[e.project_id]) stats[e.project_id] = { hours: 0, cost: 0 };
      const h = Number(e.hours);
      stats[e.project_id].hours += h;
      stats[e.project_id].cost += h * (rates[e.user_id] || 0);
    });
    setProjectStats(stats);
    setLoading(false);
  }

  function startEdit(project: any) {
    setEditingId(project.id);
    setFormName(project.name);
    setFormAddress(project.address || "");
    setFormDesc(project.description || "");
    setShowForm(false);
  }

  function startNew() {
    setEditingId(null);
    setFormName(""); setFormAddress(""); setFormDesc("");
    setShowForm(true);
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setSubmitting(true);
    if (editingId) {
      await supabase.from("projects").update({ name: formName, address: formAddress || null, description: formDesc || null }).eq("id", editingId);
      setEditingId(null);
    } else {
      await supabase.from("projects").insert({ name: formName, address: formAddress || null, description: formDesc || null });
      setShowForm(false);
    }
    setFormName(""); setFormAddress(""); setFormDesc("");
    loadData();
    setSubmitting(false);
  }

  async function toggleActive(id: string, current: boolean) {
    await supabase.from("projects").update({ is_active: !current }).eq("id", id);
    loadData();
  }

  async function deleteProject(id: string) {
    if (!confirm("Smazat zakázku?")) return;
    await supabase.from("projects").delete().eq("id", id);
    loadData();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-ink-900">Zakázky / Stavby</h2>
        <button onClick={() => { showForm ? setShowForm(false) : startNew(); setEditingId(null); }} className="btn-primary">
          {showForm ? <><X className="w-4 h-4" /> Zrušit</> : <><Plus className="w-4 h-4" /> Nová zakázka</>}
        </button>
      </div>

      {(showForm || editingId) && (
        <div className="card p-6 animate-in">
          <h3 className="font-display font-semibold mb-4">{editingId ? "Upravit zakázku" : "Nová zakázka"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Název</label><input type="text" className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Střecha Novákovi" required /></div>
              <div><label className="label">Adresa</label><input type="text" className="input" value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="Písek, Budějovická 12" /></div>
            </div>
            <div><label className="label">Popis</label><textarea className="input min-h-[60px] resize-y" value={formDesc} onChange={e => setFormDesc(e.target.value)} /></div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="btn-primary">{editingId ? "Uložit změny" : "Vytvořit"}</button>
              {editingId && <button type="button" onClick={() => setEditingId(null)} className="btn-secondary">Zrušit</button>}
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {projects.length === 0 ? (
          <div className="card px-6 py-12 text-center text-ink-500"><Building2 className="w-12 h-12 mx-auto mb-3 text-ink-300" />Žádné zakázky.</div>
        ) : projects.map(project => {
          const st = projectStats[project.id] || { hours: 0, cost: 0 };
          return (
            <div key={project.id} className={`card p-5 ${!project.is_active ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center flex-shrink-0"><Building2 className="w-5 h-5 text-brand-600" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><h3 className="font-medium text-ink-900">{project.name}</h3>{!project.is_active && <span className="badge bg-surface-200 text-ink-500">Neaktivní</span>}</div>
                  {project.address && <p className="text-sm text-ink-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" /> {project.address}</p>}
                  {project.description && <p className="text-sm text-ink-400 mt-1">{project.description}</p>}
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-ink-500">Celkem: <span className="font-semibold text-ink-900">{st.hours} h</span></span>
                    <span className="text-ink-500">Náklady: <span className="font-semibold text-ink-900">{formatCurrency(st.cost)}</span></span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(project)} className="btn-secondary p-2" title="Upravit"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => toggleActive(project.id, project.is_active)} className="btn-secondary p-2" title={project.is_active ? "Deaktivovat" : "Aktivovat"}>{project.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  <button onClick={() => deleteProject(project.id)} className="btn-secondary p-2 hover:text-red-500" title="Smazat"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatDate } from "@/lib/utils";
import { Shield, Plus, X, Trash2, Check, ListTodo, Calendar, Building2, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";

const PRIORITY = {
  urgent: { label: "Urgentní", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", order: 0 },
  high: { label: "Vysoká", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", order: 1 },
  medium: { label: "Střední", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", order: 2 },
  low: { label: "Nízká", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", order: 3 },
};

const EMPTY_FORM = { title: "", description: "", priority: "medium", dueDate: "", projectId: "" };

export default function TasksPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);

  // Editor (sdílený pro nový i úpravu). task === null => nový úkol.
  const [editor, setEditor] = useState<{ open: boolean; task: any | null }>({ open: false, task: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);
    if (p?.role !== "admin") { setLoading(false); return; }

    const [tasksRes, projRes] = await Promise.all([
      supabase.from("tasks").select("*, projects(name)").order("created_at", { ascending: false }),
      supabase.from("projects").select("*").eq("is_active", true).order("name"),
    ]);
    setTasks(tasksRes.data || []);
    setProjects(projRes.data || []);
    setLoading(false);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditor({ open: true, task: null });
  }

  function openEdit(task: any) {
    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: task.due_date || "",
      projectId: task.project_id || "",
    });
    setEditor({ open: true, task });
  }

  function closeEditor() {
    setEditor({ open: false, task: null });
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.dueDate || null,
      project_id: form.projectId || null,
    };
    if (editor.task) {
      await supabase.from("tasks").update(payload).eq("id", editor.task.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("tasks").insert({ ...payload, created_by: user?.id });
    }
    setSubmitting(false);
    closeEditor();
    loadData();
  }

  async function toggleDone(task: any) {
    await supabase.from("tasks").update({
      is_done: !task.is_done,
      done_at: !task.is_done ? new Date().toISOString() : null,
    }).eq("id", task.id);
    loadData();
  }

  async function deleteTask(id: string) {
    if (!confirm("Smazat úkol?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    closeEditor();
    loadData();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  if (profile?.role !== "admin") return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl">Přístup odepřen</h2></div>;

  const activeTasks = tasks.filter(t => !t.is_done).sort((a, b) => {
    const pa = PRIORITY[a.priority as keyof typeof PRIORITY]?.order ?? 9;
    const pb = PRIORITY[b.priority as keyof typeof PRIORITY]?.order ?? 9;
    if (pa !== pb) return pa - pb;
    // Pak podle termínu (dříve = výš)
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
  const doneTasks = tasks.filter(t => t.is_done);

  function dueDateInfo(dueDate: string | null) {
    if (!dueDate) return null;
    const days = differenceInCalendarDays(parseISO(dueDate), new Date());
    if (days < 0) return { text: `Po termínu (${Math.abs(days)} dní)`, cls: "text-red-600 font-semibold" };
    if (days === 0) return { text: "Dnes!", cls: "text-red-600 font-semibold" };
    if (days === 1) return { text: "Zítra", cls: "text-orange-600 font-medium" };
    if (days <= 3) return { text: `Za ${days} dny`, cls: "text-amber-600" };
    return { text: formatDate(dueDate), cls: "text-ink-500" };
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-bold text-xl text-ink-900">Úkoly</h2>
          <p className="text-sm text-ink-500">{activeTasks.length} otevřených úkolů</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Nový úkol
        </button>
      </div>

      {/* Active tasks */}
      {activeTasks.length === 0 ? (
        <div className="card px-6 py-12 text-center text-ink-500">
          <ListTodo className="w-12 h-12 mx-auto mb-3 text-ink-300" />
          Žádné otevřené úkoly. Vytvořte první úkol.
        </div>
      ) : (
        <div className="space-y-3">
          {activeTasks.map(task => {
            const prio = PRIORITY[task.priority as keyof typeof PRIORITY];
            const due = dueDateInfo(task.due_date);
            return (
              <div key={task.id} className="card p-4 flex items-start gap-4">
                <button onClick={() => toggleDone(task)} className="mt-0.5 w-6 h-6 rounded-lg border-2 border-surface-300 hover:border-emerald-400 hover:bg-emerald-50 flex items-center justify-center flex-shrink-0 transition-all" title="Označit jako hotové">
                </button>
                <button type="button" onClick={() => openEdit(task)} className="flex-1 min-w-0 text-left group" title="Upravit úkol">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`badge border ${prio?.color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${prio?.dot} mr-1`}></span>
                      {prio?.label}
                    </span>
                    {task.priority === "urgent" && <AlertTriangle className="w-4 h-4 text-red-500" />}
                    {due && <span className={`text-xs flex items-center gap-1 ${due.cls}`}><Calendar className="w-3 h-3" />{due.text}</span>}
                    {task.projects?.name && <span className="text-xs text-ink-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{task.projects.name}</span>}
                  </div>
                  <p className="font-medium text-ink-900 group-hover:text-brand-700 transition-colors">{task.title}</p>
                  {task.description && <p className="text-sm text-ink-500 mt-0.5">{task.description}</p>}
                </button>
                <button onClick={() => deleteTask(task.id)} className="text-ink-300 hover:text-red-500 flex-shrink-0" title="Smazat úkol"><Trash2 className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

      {/* Done tasks */}
      {doneTasks.length > 0 && (
        <div>
          <button onClick={() => setShowDone(!showDone)} className="flex items-center gap-2 text-sm text-ink-500 hover:text-ink-700 mb-3">
            <CheckCircle2 className="w-4 h-4" />
            Hotové úkoly ({doneTasks.length}) {showDone ? "▲" : "▼"}
          </button>
          {showDone && (
            <div className="space-y-2">
              {doneTasks.map(task => (
                <div key={task.id} className="card p-3 flex items-center gap-3 opacity-60">
                  <button onClick={() => toggleDone(task)} className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0" title="Vrátit zpět">
                    <Check className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => openEdit(task)} className="flex-1 min-w-0 text-left" title="Upravit úkol">
                    <p className="font-medium text-ink-700 line-through">{task.title}</p>
                    {task.projects?.name && <span className="text-xs text-ink-400">{task.projects.name}</span>}
                  </button>
                  <button onClick={() => deleteTask(task.id)} className="text-ink-300 hover:text-red-500 flex-shrink-0" title="Smazat úkol"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor modal (nový / úprava) */}
      {editor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 backdrop-blur-sm p-4" onClick={closeEditor}>
          <div className="card p-6 w-full max-w-lg animate-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-lg">{editor.task ? "Upravit úkol" : "Nový úkol"}</h3>
              <button onClick={closeEditor} className="text-ink-400 hover:text-ink-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Název úkolu *</label>
                <input type="text" className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Objednat materiál na střechu..." required autoFocus />
              </div>
              <div>
                <label className="label">Popis</label>
                <textarea className="input min-h-[60px] resize-y" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detaily úkolu..." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label">Priorita</label>
                  <select className="input" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                    <option value="urgent">Urgentní</option>
                    <option value="high">Vysoká</option>
                    <option value="medium">Střední</option>
                    <option value="low">Nízká</option>
                  </select>
                </div>
                <div>
                  <label className="label">Termín</label>
                  <input type="date" className="input" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
                </div>
                <div>
                  <label className="label">Zakázka (volitelné)</label>
                  <select className="input" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">-- žádná --</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting || !form.title.trim()} className="btn-primary flex-1">
                  <Save className="w-4 h-4" /> {submitting ? "Ukládání..." : editor.task ? "Uložit změny" : "Vytvořit úkol"}
                </button>
                {editor.task && (
                  <button type="button" onClick={() => deleteTask(editor.task.id)} className="btn-danger" title="Smazat úkol"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

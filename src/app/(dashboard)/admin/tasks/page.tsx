"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import { formatDate } from "@/lib/utils";
import { Shield, Plus, X, Trash2, Search, LayoutList, Columns3, Calendar, Building2, AlertTriangle, GripVertical, Save } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, closestCorners,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PRIORITY = {
  urgent: { label: "Urgentní", color: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", order: 0 },
  high: { label: "Vysoká", color: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500", order: 1 },
  medium: { label: "Střední", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500", order: 2 },
  low: { label: "Nízká", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500", order: 3 },
};

type Status = "todo" | "in_progress" | "done" | "cancelled";

const STATUSES: { id: Status; label: string; dot: string; order: number }[] = [
  { id: "todo", label: "K udělání", dot: "bg-brand-500", order: 0 },
  { id: "in_progress", label: "Probíhá", dot: "bg-amber-500", order: 1 },
  { id: "done", label: "Hotovo", dot: "bg-emerald-500", order: 2 },
  { id: "cancelled", label: "Zrušeno", dot: "bg-ink-300", order: 3 },
];
const STATUS_IDS = STATUSES.map(s => s.id) as Status[];
const STATUS_META = Object.fromEntries(STATUSES.map(s => [s.id, s])) as Record<Status, typeof STATUSES[number]>;

function taskStatus(t: any): Status {
  if (t?.status && STATUS_IDS.includes(t.status)) return t.status;
  return t?.is_done ? "done" : "todo";
}

const EMPTY_FORM = { title: "", description: "", priority: "medium", dueDate: "", projectId: "", status: "todo" as Status };

export default function TasksPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Lišta / filtry
  const [view, setView] = useState<"list" | "board">("list");
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<"all" | Status>("all");
  const [fPriority, setFPriority] = useState("all");
  const [fProject, setFProject] = useState("all");

  // Editor
  const [editor, setEditor] = useState<{ open: boolean; task: any | null }>({ open: false, task: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Drag
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("tasksView") : null;
    if (saved === "list" || saved === "board") setView(saved);
  }, []);
  function changeView(v: "list" | "board") {
    setView(v);
    if (typeof window !== "undefined") window.localStorage.setItem("tasksView", v);
  }

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

  // ---- Editor ----
  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditor({ open: true, task: null });
  }
  function openEdit(task: any) {
    setForm({
      title: task.title || "",
      description: task.description || "",
      priority: task.priority || "medium",
      dueDate: task.due_date || "",
      projectId: task.project_id || "",
      status: taskStatus(task),
    });
    setEditor({ open: true, task });
  }
  function closeEditor() { setEditor({ open: false, task: null }); }

  async function handleSubmit(e: any) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    const doneNow = form.status === "done";
    const payload: any = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.dueDate || null,
      project_id: form.projectId || null,
      status: form.status,
      is_done: doneNow,
    };
    if (editor.task) {
      // done_at: nastav jen při přechodu do/z hotovo, ať nepřepíšu původní čas
      if (doneNow && !editor.task.is_done) payload.done_at = new Date().toISOString();
      if (!doneNow && editor.task.is_done) payload.done_at = null;
      await supabase.from("tasks").update(payload).eq("id", editor.task.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      payload.done_at = doneNow ? new Date().toISOString() : null;
      await supabase.from("tasks").insert(payload);
    }
    setSubmitting(false);
    closeEditor();
    loadData();
  }

  async function deleteTask(id: string) {
    if (!confirm("Smazat úkol?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    closeEditor();
    loadData();
  }

  // Optimistický zápis patchů (lokálně i do DB)
  async function persistTaskUpdates(updates: { id: string; patch: any }[]) {
    if (updates.length === 0) return;
    setTasks(prev => prev.map(t => {
      const u = updates.find(x => x.id === t.id);
      return u ? { ...t, ...u.patch } : t;
    }));
    await Promise.all(updates.map(u => supabase.from("tasks").update(u.patch).eq("id", u.id)));
  }

  async function setTaskStatus(task: any, next: Status) {
    if (taskStatus(task) === next) return;
    await persistTaskUpdates([{ id: task.id, patch: {
      status: next, is_done: next === "done",
      done_at: next === "done" ? new Date().toISOString() : null,
    } }]);
  }

  // ---- Filtrování ----
  function matchesFilters(t: any) {
    const q = search.trim().toLowerCase();
    const okSearch = !q || (t.title || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
    const okPriority = fPriority === "all" || t.priority === fPriority;
    const okProject = fProject === "all" || (t.project_id || "") === fProject;
    return okSearch && okPriority && okProject;
  }

  const board = useMemo(() => {
    const g: Record<Status, any[]> = { todo: [], in_progress: [], done: [], cancelled: [] };
    tasks.filter(matchesFilters).forEach(t => g[taskStatus(t)].push(t));
    STATUS_IDS.forEach(s => g[s].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, search, fPriority, fProject]);

  const listTasks = useMemo(() => {
    let arr = tasks.filter(matchesFilters);
    if (fStatus !== "all") arr = arr.filter(t => taskStatus(t) === fStatus);
    return arr.sort((a, b) => {
      const sa = STATUS_META[taskStatus(a)].order, sb = STATUS_META[taskStatus(b)].order;
      if (sa !== sb) return sa - sb;
      const pa = PRIORITY[a.priority as keyof typeof PRIORITY]?.order ?? 9;
      const pb = PRIORITY[b.priority as keyof typeof PRIORITY]?.order ?? 9;
      if (pa !== pb) return pa - pb;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, search, fPriority, fProject, fStatus]);

  const tasksById = useMemo(() => Object.fromEntries(tasks.map(t => [t.id, t])), [tasks]);
  const openCount = tasks.filter(t => { const s = taskStatus(t); return s === "todo" || s === "in_progress"; }).length;

  // ---- Drag & drop ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(e: DragStartEvent) { setActiveId(String(e.active.id)); }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    const movedTask = tasksById[activeIdStr];
    if (!movedTask) return;

    const fromStatus = taskStatus(movedTask);
    const toStatus: Status = STATUS_IDS.includes(overIdStr as Status)
      ? (overIdStr as Status)
      : taskStatus(tasksById[overIdStr]);
    if (!toStatus) return;

    const fromArr = board[fromStatus];
    const toArr = board[toStatus];

    if (fromStatus === toStatus) {
      const oldIndex = fromArr.findIndex(t => t.id === activeIdStr);
      const overIndex = overIdStr === toStatus ? toArr.length - 1 : toArr.findIndex(t => t.id === overIdStr);
      if (oldIndex < 0 || overIndex < 0 || oldIndex === overIndex) return;
      const newArr = arrayMove(toArr, oldIndex, overIndex);
      persistTaskUpdates(newArr.map((t, i) => ({ id: t.id, patch: { sort_order: i } })));
    } else {
      const overIndex = overIdStr === toStatus ? toArr.length : toArr.findIndex(t => t.id === overIdStr);
      const insertAt = overIndex < 0 ? toArr.length : overIndex;
      const newFrom = fromArr.filter(t => t.id !== activeIdStr);
      const newTo = [...toArr.slice(0, insertAt), movedTask, ...toArr.slice(insertAt)];
      const doneNow = toStatus === "done";
      const updates = [
        ...newFrom.map((t, i) => ({ id: t.id, patch: { sort_order: i } })),
        ...newTo.map((t, i) => t.id === activeIdStr
          ? { id: t.id, patch: { sort_order: i, status: toStatus, is_done: doneNow, done_at: doneNow ? new Date().toISOString() : null } }
          : { id: t.id, patch: { sort_order: i } }),
      ];
      persistTaskUpdates(updates);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  if (profile?.role !== "admin") return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl">Přístup odepřen</h2></div>;

  const activeTask = activeId ? tasksById[activeId] : null;

  return (
    <div className={`${view === "board" ? "max-w-7xl" : "max-w-4xl"} mx-auto space-y-5`}>
      {/* Hlavička */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-ink-900">Úkoly</h2>
          <p className="text-sm text-ink-500">{openCount} otevřených úkolů</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> Nový úkol</button>
      </div>

      {/* Lišta */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-ink-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat úkoly..." className="input pl-9" />
        </div>
        {view === "list" && (
          <select value={fStatus} onChange={e => setFStatus(e.target.value as any)} className="input w-auto">
            <option value="all">Status</option>
            {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        )}
        <select value={fPriority} onChange={e => setFPriority(e.target.value)} className="input w-auto">
          <option value="all">Priorita</option>
          <option value="urgent">Urgentní</option>
          <option value="high">Vysoká</option>
          <option value="medium">Střední</option>
          <option value="low">Nízká</option>
        </select>
        <select value={fProject} onChange={e => setFProject(e.target.value)} className="input w-auto">
          <option value="all">Projekt</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex rounded-xl border border-surface-200 overflow-hidden ml-auto">
          <button onClick={() => changeView("list")} title="Seznam"
            className={`p-2.5 transition-colors ${view === "list" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-surface-100"}`}>
            <LayoutList className="w-4 h-4" />
          </button>
          <button onClick={() => changeView("board")} title="Board"
            className={`p-2.5 transition-colors ${view === "board" ? "bg-brand-600 text-white" : "bg-white text-ink-500 hover:bg-surface-100"}`}>
            <Columns3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* SEZNAM */}
      {view === "list" && (
        listTasks.length === 0 ? (
          <div className="card px-6 py-12 text-center text-ink-500">Žádné úkoly neodpovídají filtru.</div>
        ) : (
          <div className="space-y-3">
            {listTasks.map(task => <ListRow key={task.id} task={task} onEdit={() => openEdit(task)} onToggle={() => setTaskStatus(task, taskStatus(task) === "done" ? "todo" : "done")} onDelete={() => deleteTask(task.id)} />)}
          </div>
        )
      )}

      {/* BOARD */}
      {view === "board" && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {STATUSES.map(s => (
              <Column key={s.id} status={s.id} tasks={board[s.id]} onCardClick={openEdit} />
            ))}
          </div>
          <DragOverlay>
            {activeTask ? <BoardCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Editor modal */}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="label">Status</label>
                  <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Status })}>
                    {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
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
                  <label className="label">Zakázka</label>
                  <select className="input" value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
                    <option value="">--</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={submitting || !form.title.trim()} className="btn-primary flex-1">
                  <Save className="w-4 h-4" /> {submitting ? "Ukládání..." : editor.task ? "Uložit změny" : "Vytvořit úkol"}
                </button>
                {editor.task && <button type="button" onClick={() => deleteTask(editor.task.id)} className="btn-danger" title="Smazat úkol"><Trash2 className="w-4 h-4" /></button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function dueInfo(dueDate: string | null) {
  if (!dueDate) return null;
  const days = differenceInCalendarDays(parseISO(dueDate), new Date());
  if (days < 0) return { text: `Po termínu (${Math.abs(days)} dní)`, cls: "text-red-600 font-semibold" };
  if (days === 0) return { text: "Dnes!", cls: "text-red-600 font-semibold" };
  if (days === 1) return { text: "Zítra", cls: "text-orange-600 font-medium" };
  if (days <= 3) return { text: `Za ${days} dny`, cls: "text-amber-600" };
  return { text: formatDate(dueDate), cls: "text-ink-500" };
}

function PriorityBadge({ priority }: { priority: string }) {
  const prio = PRIORITY[priority as keyof typeof PRIORITY];
  if (!prio) return null;
  return <span className={`badge border ${prio.color}`}><span className={`w-1.5 h-1.5 rounded-full ${prio.dot} mr-1`}></span>{prio.label}</span>;
}

// ---- Řádek seznamu ----
function ListRow({ task, onEdit, onToggle, onDelete }: { task: any; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const due = dueInfo(task.due_date);
  const st = taskStatus(task);
  const meta = STATUS_META[st];
  const done = st === "done";
  const cancelled = st === "cancelled";
  return (
    <div className={`card p-4 flex items-start gap-4 ${done || cancelled ? "opacity-70" : ""}`}>
      <button onClick={onToggle} className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${done ? "bg-emerald-100 border-emerald-300 text-emerald-600" : "border-surface-300 hover:border-emerald-400 hover:bg-emerald-50"}`} title={done ? "Vrátit mezi otevřené" : "Označit jako hotové"}>
        {done && <span className="text-sm leading-none">✓</span>}
      </button>
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left group" title="Upravit úkol">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-500"><span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`}></span>{meta.label}</span>
          <PriorityBadge priority={task.priority} />
          {task.priority === "urgent" && !done && <AlertTriangle className="w-4 h-4 text-red-500" />}
          {due && !done && !cancelled && <span className={`text-xs flex items-center gap-1 ${due.cls}`}><Calendar className="w-3 h-3" />{due.text}</span>}
          {task.projects?.name && <span className="text-xs text-ink-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{task.projects.name}</span>}
        </div>
        <p className={`font-medium text-ink-900 group-hover:text-brand-700 transition-colors ${done || cancelled ? "line-through" : ""}`}>{task.title}</p>
        {task.description && <p className="text-sm text-ink-500 mt-0.5">{task.description}</p>}
      </button>
      <button onClick={onDelete} className="text-ink-300 hover:text-red-500 flex-shrink-0" title="Smazat úkol"><Trash2 className="w-4 h-4" /></button>
    </div>
  );
}

// ---- Sloupec boardu ----
function Column({ status, tasks, onCardClick }: { status: Status; tasks: any[]; onCardClick: (t: any) => void }) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-1 mb-2">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`}></span>
        <span className="font-semibold text-sm text-ink-700">{meta.label}</span>
        <span className="text-xs text-ink-400 bg-surface-100 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">{tasks.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex-1 rounded-2xl p-2 space-y-2 min-h-[120px] transition-colors border ${isOver ? "bg-brand-50 border-brand-200" : "bg-surface-50 border-surface-200/60"}`}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0
            ? <div className="text-center text-xs text-ink-300 py-8 select-none">Žádné úkoly</div>
            : tasks.map(t => <SortableCard key={t.id} task={t} onClick={() => onCardClick(t)} />)}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableCard({ task, onClick }: { task: any; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      <BoardCard task={task} />
    </div>
  );
}

function BoardCard({ task, overlay = false }: { task: any; overlay?: boolean }) {
  const due = dueInfo(task.due_date);
  const st = taskStatus(task);
  const muted = st === "done" || st === "cancelled";
  return (
    <div className={`card p-3 select-none ${overlay ? "shadow-lg cursor-grabbing rotate-1" : "cursor-grab active:cursor-grabbing hover:border-brand-300"} ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-1.5">
        <GripVertical className="w-4 h-4 text-ink-300 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className={`font-medium text-sm text-ink-900 ${muted ? "line-through" : ""}`}>{task.title}</p>
          <div className="flex items-center gap-2 flex-wrap mt-1.5">
            <PriorityBadge priority={task.priority} />
            {due && !muted && <span className={`text-xs flex items-center gap-1 ${due.cls}`}><Calendar className="w-3 h-3" />{due.text}</span>}
          </div>
          {task.projects?.name && <p className="text-xs text-ink-400 flex items-center gap-1 mt-1"><Building2 className="w-3 h-3" />{task.projects.name}</p>}
        </div>
      </div>
    </div>
  );
}

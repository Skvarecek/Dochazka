"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { formatDate, entryTypeLabel, entryTypeColor } from "@/lib/utils";
import { Clock, CalendarCheck, TrendingUp } from "lucide-react";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cs } from "date-fns/locale";

export default function DashboardPage() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ workHours: 0, vacationDays: 0, sickDays: 0, dayOffDays: 0 });
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setProfile(p);

    const now = new Date();
    const monthStart = startOfMonth(now).toISOString().split("T")[0];
    const monthEnd = endOfMonth(now).toISOString().split("T")[0];

    const { data: entries } = await supabase
      .from("work_entries").select("*, projects(name)").eq("user_id", user.id)
      .gte("date", monthStart).lte("date", monthEnd).order("date", { ascending: false });

    const e = entries || [];
    setStats({
      workHours: e.filter(x => x.entry_type === "work").reduce((s, x) => s + Number(x.hours), 0),
      vacationDays: e.filter(x => x.entry_type === "vacation").length,
      sickDays: e.filter(x => x.entry_type === "sick").length,
      dayOffDays: e.filter(x => x.entry_type === "day_off").length,
    });
    setRecentEntries(e.slice(0, 15));
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="font-display font-bold text-2xl text-ink-900">Ahoj, {profile?.full_name?.split(" ")[0]}!</h2>
        <p className="text-ink-500 text-sm">{format(new Date(), "LLLL yyyy", { locale: cs })}</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center"><Clock className="w-5 h-5 text-blue-600" /></div><span className="text-sm text-ink-500">Odpracováno</span></div><p className="text-2xl font-display font-bold text-ink-900">{stats.workHours} <span className="text-base font-normal text-ink-300">h</span></p></div>
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center"><CalendarCheck className="w-5 h-5 text-emerald-600" /></div><span className="text-sm text-ink-500">Dovolená</span></div><p className="text-2xl font-display font-bold text-ink-900">{stats.vacationDays} <span className="text-base font-normal text-ink-300">dní</span></p></div>
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-amber-600" /></div><span className="text-sm text-ink-500">Nemoc</span></div><p className="text-2xl font-display font-bold text-ink-900">{stats.sickDays} <span className="text-base font-normal text-ink-300">dní</span></p></div>
        <div className="card p-5"><div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center"><Clock className="w-5 h-5 text-purple-600" /></div><span className="text-sm text-ink-500">Volno</span></div><p className="text-2xl font-display font-bold text-ink-900">{stats.dayOffDays} <span className="text-base font-normal text-ink-300">dní</span></p></div>
      </div>
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-200"><h3 className="font-display font-semibold text-ink-900">Záznamy tento měsíc</h3></div>
        {recentEntries.length === 0 ? (
          <div className="px-6 py-12 text-center text-ink-500">Žádné záznamy. Přejdi na "Zápis hodin".</div>
        ) : (
          <div className="divide-y divide-surface-100">
            {recentEntries.map(entry => (
              <div key={entry.id} className="px-6 py-3 flex items-center gap-4">
                <div className="w-16 text-xs text-ink-500">{formatDate(entry.date, "EEE d.M.")}</div>
                <span className={`badge ${entryTypeColor(entry.entry_type)}`}>{entryTypeLabel(entry.entry_type)}</span>
                <div className="flex-1 min-w-0 text-sm text-ink-700 truncate">
                  {entry.projects?.name && <span className="font-medium">{entry.projects.name}</span>}
                  {entry.location && <span className="text-ink-400"> · {entry.location}</span>}
                  {entry.note && <span className="text-ink-500"> – {entry.note}</span>}
                </div>
                <div className="font-mono text-sm font-medium text-ink-900">{Number(entry.hours)} h</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Clock, Shield, LogOut, Menu, X, ChevronRight, Wallet, Building2, ClipboardList } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Můj přehled", icon: LayoutDashboard },
  { href: "/hours", label: "Zápis hodin", icon: Clock },
];
const adminItems = [
  { href: "/admin/board", label: "Nástěnka", icon: ClipboardList },
  { href: "/admin", label: "Zaměstnanci", icon: Shield },
  { href: "/admin/projects", label: "Zakázky", icon: Building2 },
  { href: "/admin/payroll", label: "Výplaty", icon: Wallet },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) setProfile(data);
    })();
  }, []);

  async function handleLogout() { await supabase.auth.signOut(); router.push("/login"); }

  const allNav = [...navItems, ...(profile?.role === "admin" ? adminItems : [])];

  return (
    <div className="min-h-screen flex bg-surface-50">
      {sidebarOpen && <div className="fixed inset-0 z-30 bg-ink-900/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={cn("fixed z-40 inset-y-0 left-0 w-72 bg-white border-r border-surface-200 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 lg:static lg:z-auto", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 px-6 h-16 border-b border-surface-200">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center"><Clock className="w-5 h-5 text-white" /></div>
          <div><span className="font-display font-bold text-lg text-ink-900">INEX-CZ</span><p className="text-[10px] text-ink-400 -mt-0.5">Docházkový systém</p></div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden text-ink-500"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 py-1 text-[10px] font-semibold text-ink-300 uppercase tracking-wider">Zaměstnanec</p>
          {navItems.map(item => {
            const active = pathname === item.href;
            return <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all", active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-surface-100")}><item.icon className={cn("w-5 h-5", active ? "text-brand-600" : "text-ink-300")} />{item.label}{active && <ChevronRight className="w-4 h-4 ml-auto text-brand-400" />}</a>;
          })}
          {profile?.role === "admin" && <>
            <p className="px-3 py-1 mt-4 text-[10px] font-semibold text-ink-300 uppercase tracking-wider">Administrace</p>
            {adminItems.map(item => {
              const active = pathname === item.href;
              return <a key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all", active ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:bg-surface-100")}><item.icon className={cn("w-5 h-5", active ? "text-brand-600" : "text-ink-300")} />{item.label}{active && <ChevronRight className="w-4 h-4 ml-auto text-brand-400" />}</a>;
            })}
          </>}
        </nav>
        <div className="p-4 border-t border-surface-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center font-display font-semibold text-brand-700 text-sm">{profile?.full_name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}</div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-ink-900 truncate">{profile?.full_name || "..."}</p><p className="text-xs text-ink-500">{profile?.role === "admin" ? "Admin" : "Zaměstnanec"}</p></div>
          </div>
          <button onClick={handleLogout} className="btn-secondary w-full text-sm"><LogOut className="w-4 h-4" /> Odhlásit se</button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/80 backdrop-blur-md border-b border-surface-200 flex items-center px-4 lg:px-8">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden mr-3 text-ink-500"><Menu className="w-6 h-6" /></button>
          <h1 className="font-display font-semibold text-lg text-ink-900">{allNav.find(n => n.href === pathname)?.label || "INEX-CZ"}</h1>
        </header>
        <main className="flex-1 p-4 lg:p-8 animate-in">{children}</main>
      </div>
    </div>
  );
}

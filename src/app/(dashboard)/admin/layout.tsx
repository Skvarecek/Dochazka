"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Shield } from "lucide-react";

// Stránky pod /admin, které smí otevřít i ne-admin (data v nich dál omezuje RLS).
const OPEN_TO_EMPLOYEES = ["/admin/board"];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const isOpen = OPEN_TO_EMPLOYEES.includes(pathname);
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    if (isOpen) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccess("denied"); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setAccess(data?.role === "admin" ? "admin" : "denied");
    })();
  }, [isOpen]);

  if (isOpen || access === "admin") return <>{children}</>;
  if (access === "loading") return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl">Přístup odepřen</h2></div>;
}

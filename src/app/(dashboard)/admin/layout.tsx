"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Shield } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [access, setAccess] = useState<"loading" | "admin" | "denied">("loading");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAccess("denied"); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      setAccess(data?.role === "admin" ? "admin" : "denied");
    })();
  }, []);

  if (access === "admin") return <>{children}</>;
  if (access === "loading") return <div className="flex items-center justify-center h-64"><div className="animate-pulse text-ink-500">Načítání...</div></div>;
  return <div className="max-w-md mx-auto text-center py-16"><Shield className="w-16 h-16 text-ink-300 mx-auto mb-4" /><h2 className="font-display font-bold text-xl">Přístup odepřen</h2></div>;
}

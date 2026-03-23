"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { Clock, LogIn, UserPlus, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else {
        setMessage({
          type: "success",
          text: "Registrace úspěšná! Zkontrolujte svůj e-mail pro potvrzení.",
        });
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setMessage({ type: "error", text: "Nesprávný e-mail nebo heslo." });
      } else {
        window.location.href = "/dashboard";
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-brand-50 via-surface-50 to-brand-100">
      {/* Decorative background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-300/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white mb-4 shadow-lg shadow-brand-300/50">
            <Clock className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-display font-bold text-ink-900">
            Docházka
          </h1>
          <p className="text-ink-500 mt-1">Firemní docházkový systém</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="text-xl font-display font-semibold mb-6">
            {isSignUp ? "Vytvořit účet" : "Přihlášení"}
          </h2>

          {message && (
            <div
              className={`mb-4 p-3 rounded-xl text-sm ${
                message.type === "error"
                  ? "bg-red-50 text-red-700 border border-red-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="label" htmlFor="fullName">
                  Celé jméno
                </label>
                <input
                  id="fullName"
                  type="text"
                  className="input"
                  placeholder="Jan Novák"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="jan@firma.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="password">
                Heslo
              </label>
              <input
                id="password"
                type="password"
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="animate-pulse">Načítání...</span>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  Registrovat
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Přihlásit se
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setMessage(null);
              }}
              className="text-sm text-brand-600 hover:text-brand-700 font-medium inline-flex items-center gap-1 transition-colors"
            >
              {isSignUp
                ? "Už máte účet? Přihlaste se"
                : "Nemáte účet? Zaregistrujte se"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

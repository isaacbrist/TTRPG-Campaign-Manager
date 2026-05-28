"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { inputClass } from "@/lib/ui";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);

    // Client-side empty-field check before hitting the API
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      router.replace("/");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed.";
      // Surface the backend's message if it's a clean error string
      if (message === "Network error — no response received") {
        setError("Something went wrong. Check your connection.");
      } else {
        setError(message.includes("401") ? "Invalid email or password." : message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-amber-500 text-4xl">⚔</span>
          <h1 className="font-cinzel text-2xl text-amber-400 mt-3 tracking-wide">Campaign Manager</h1>
          <p className="text-stone-500 text-sm mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
          <form action={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-stone-400 text-xs uppercase tracking-wider mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="dungeon@master.com"
              />
            </div>
            <div>
              <label className="block text-stone-400 text-xs uppercase tracking-wider mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-stone-950 font-semibold py-2.5 rounded-lg transition-all shadow-md text-sm"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="flex items-center justify-between text-sm mt-6">
            <p className="text-stone-500">
              No account?{" "}
              <Link href="/register" className="text-amber-400 hover:text-amber-300 transition-colors">
                Create one
              </Link>
            </p>
            <Link href="/forgot-password" className="text-stone-500 hover:text-amber-400 transition-colors">
              Forgot password?
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

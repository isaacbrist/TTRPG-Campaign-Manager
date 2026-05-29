"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/Toast";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { FormField } from "@/components/FormField";
import { inputClass } from "@/lib/ui";

export default function RegisterPageClient() {
  const { register } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [loading, submit] = useAsyncAction((err: unknown) => {
    const message = err instanceof Error ? err.message : "Registration failed.";
    if (message === "Network error — no response received") {
      setError("Something went wrong. Check your connection.");
    } else {
      setError(message.includes("409") ? "An account with that email already exists." : message);
    }
  });

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    await submit(async () => {
      await register(email, password);
      toast.success("Account created! Welcome.");
      router.replace("/");
    });
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-amber-500 text-4xl">⚔</span>
          <h1 className="font-cinzel text-2xl text-amber-400 mt-3 tracking-wide">Campaign Manager</h1>
          <p className="text-stone-500 text-sm mt-1">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-5">
            <FormField label="Email" id="email">
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
            </FormField>
            <FormField label="Password" id="password">
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="At least 8 characters"
              />
            </FormField>
            <FormField label="Confirm Password" id="confirm">
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </FormField>

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
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-center text-stone-500 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

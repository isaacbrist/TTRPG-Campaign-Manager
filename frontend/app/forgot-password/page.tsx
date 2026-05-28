"use client";
import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { inputClass } from "@/lib/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
          <p className="text-stone-500 text-sm mt-1">Reset your password</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="text-4xl">📬</div>
              <h2 className="font-cinzel text-lg text-amber-400">Check your inbox</h2>
              <p className="text-stone-400 text-sm leading-relaxed">
                If an account exists for <span className="text-stone-200">{email}</span>,
                you'll receive a reset link shortly. It expires in 1 hour.
              </p>
              <p className="text-stone-500 text-sm">
                Didn't get it? Check your spam folder, or{" "}
                <button
                  onClick={() => { setSubmitted(false); setEmail(""); }}
                  className="text-amber-400 hover:text-amber-300 transition-colors"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <form action={handleSubmit} className="space-y-5">
              <p className="text-stone-400 text-sm">
                Enter the email address for your account and we'll send you a link to reset your password.
              </p>

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
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>
          )}

          <p className="text-center text-stone-500 text-sm mt-6">
            <Link href="/login" className="text-amber-400 hover:text-amber-300 transition-colors">
              ← Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

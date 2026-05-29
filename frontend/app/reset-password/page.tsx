"use client";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { FormField } from "@/components/FormField";
import { inputClass } from "@/lib/ui";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  // Redirect to login after a successful reset
  useEffect(() => {
    if (!succeeded) return;
    const timer = setTimeout(() => router.replace("/login"), 3000);
    return () => clearTimeout(timer);
  }, [succeeded, router]);

  const [loading, submit] = useAsyncAction((err: unknown) => {
    const message = err instanceof Error ? err.message : "";
    setError(
      message.includes("invalid or has expired")
        ? "This reset link is invalid or has expired. Please request a new one."
        : "Something went wrong. Please try again."
    );
  });

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">🔗</div>
        <h2 className="font-cinzel text-lg text-red-400">Invalid link</h2>
        <p className="text-stone-400 text-sm">
          This reset link is missing its token. Please request a new one.
        </p>
        <Link href="/forgot-password" className="inline-block text-amber-400 hover:text-amber-300 transition-colors text-sm">
          Request new link →
        </Link>
      </div>
    );
  }

  if (succeeded) {
    return (
      <div className="text-center space-y-4">
        <div className="text-4xl">✅</div>
        <h2 className="font-cinzel text-lg text-amber-400">Password updated</h2>
        <p className="text-stone-400 text-sm">
          Your password has been changed. Redirecting you to sign in…
        </p>
        <Link href="/login" className="inline-block text-amber-400 hover:text-amber-300 transition-colors text-sm">
          Sign In →
        </Link>
      </div>
    );
  }

  async function handleSubmit() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    await submit(async () => {
      await resetPassword(token!, password);
      setSucceeded(true);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      <p className="text-stone-400 text-sm">Choose a new password for your account.</p>

      <FormField label="New Password" id="password">
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
          {error.includes("expired") && (
            <>
              {" "}
              <Link href="/forgot-password" className="underline text-red-300 hover:text-red-200 transition-colors">
                Request a new link
              </Link>
              .
            </>
          )}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-stone-950 font-semibold py-2.5 rounded-lg transition-all shadow-md text-sm"
      >
        {loading ? "Updating…" : "Set New Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-amber-500 text-4xl">⚔</span>
          <h1 className="font-cinzel text-2xl text-amber-400 mt-3 tracking-wide">Campaign Manager</h1>
          <p className="text-stone-500 text-sm mt-1">Set a new password</p>
        </div>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-8 shadow-2xl shadow-black/60">
          {/* useSearchParams must be inside Suspense in Next.js 15 */}
          <Suspense fallback={<p className="text-stone-500 text-sm text-center">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>

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

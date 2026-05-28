"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Epoch ms when the countdown expires (set for rate-limit toasts). */
  countdownTo?: number;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Shows a rate-limit error. If `retryAfter` is provided (seconds), displays a live countdown. */
  rateLimitError: (retryAfter?: number) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, variant: ToastVariant, countdownSecs?: number) => {
      const id = ++nextId;
      const countdownTo = countdownSecs != null ? Date.now() + countdownSecs * 1000 : undefined;
      setToasts((prev) => [...prev, { id, message, variant, countdownTo }]);
      // Dismiss slightly after the countdown expires, or variant-tuned for normal toasts:
      // success → 3 s (read quickly), error → 5 s (needs more time to read), info → 4 s
      const defaultMs = variant === "success" ? 3000 : variant === "error" ? 5000 : 4000;
      const duration = countdownSecs != null ? countdownSecs * 1000 + 800 : defaultMs;
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (msg) => show(msg, "success"),
    error:   (msg) => show(msg, "error"),
    info:    (msg) => show(msg, "info"),
    rateLimitError: (retryAfter?: number) =>
      show("AI limit reached — try again in a moment", "error", retryAfter),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast stack — fixed top-right */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Single toast ───────────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-700/60 bg-green-950/90 text-green-300 shadow-green-950/40",
  error:   "border-red-700/60   bg-red-950/90   text-red-300   shadow-red-950/40",
  info:    "border-stone-600/60 bg-stone-900/90 text-stone-200 shadow-stone-950/40",
};

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: "✓",
  error:   "✕",
  info:    "ℹ",
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [remaining, setRemaining] = useState<number>(() =>
    toast.countdownTo
      ? Math.max(0, Math.ceil((toast.countdownTo - Date.now()) / 1000))
      : 0
  );

  useEffect(() => {
    if (!toast.countdownTo) return;
    const tick = () => {
      setRemaining(Math.max(0, Math.ceil((toast.countdownTo! - Date.now()) / 1000)));
    };
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [toast.countdownTo]);

  const displayMessage =
    toast.countdownTo && remaining > 0
      ? `AI limit reached — try again in ${remaining}s`
      : toast.message;

  return (
    <div
      className={`toast-enter pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm text-sm ${VARIANT_STYLES[toast.variant]}`}
    >
      <span className="font-bold shrink-0 mt-px">{VARIANT_ICONS[toast.variant]}</span>
      <p className="flex-1 leading-snug">{displayMessage}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-px leading-none"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

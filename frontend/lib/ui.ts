/**
 * Shared Tailwind class strings used across multiple pages/components.
 * Import from here instead of duplicating the same long strings.
 */

/**
 * Standard text input used on auth pages (login, register) and campaign modals.
 * Larger padding (py-3) and full-width by default.
 */
export const inputClass =
  "w-full bg-stone-800 border border-stone-700/80 rounded-lg px-4 py-3 text-stone-100 " +
  "placeholder-stone-600 focus:outline-none focus:border-amber-600/60 focus:ring-1 " +
  "focus:ring-amber-600/20 transition-colors";

/**
 * Compact text input used inside NPC edit panels and similar tight layouts.
 */
export const inputCompactClass =
  "bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-100 " +
  "placeholder-stone-600 focus:outline-none focus:border-amber-600/60 text-sm transition-colors";

/** Primary amber action button. */
export const btnPrimaryClass =
  "bg-amber-600 hover:bg-amber-500 active:scale-95 disabled:opacity-50 " +
  "disabled:cursor-not-allowed text-stone-950 font-semibold transition-all";

import type { ReactNode } from "react";

/**
 * Standard labeled form field used across auth pages and campaign modals.
 * Renders a label + any child input/textarea, with an optional required marker.
 */
export function FormField({
  label,
  required,
  id,
  children,
}: {
  label: string;
  required?: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-stone-400 text-xs uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-amber-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

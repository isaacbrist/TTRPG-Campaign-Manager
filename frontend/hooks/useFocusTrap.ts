import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "details > summary",
].join(", ");

/**
 * Traps keyboard focus within a container element while active.
 *
 * - Tab / Shift+Tab cycle only among focusable elements inside the container.
 * - On activation, moves focus to the first focusable child.
 * - On deactivation / unmount, restores focus to the element that was active
 *   before the trap opened (i.e. the trigger button).
 *
 * Usage:
 *   const ref = useFocusTrap<HTMLDivElement>();
 *   return <div ref={ref} role="dialog" aria-modal="true">…</div>;
 *
 * Pass `active={false}` to disable the trap while keeping the ref attached.
 */
export function useFocusTrap<T extends HTMLElement = HTMLElement>(
  active: boolean = true
) {
  const containerRef = useRef<T>(null);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    // Remember what was focused so we can restore it on close
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const getFocusables = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));

    // Move focus into the dialog on open
    const focusables = getFocusables();
    if (focusables.length > 0) {
      focusables[0].focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const els = getFocusables();
      if (els.length === 0) return;

      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey) {
        // Shift+Tab on first element → wrap to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab on last element → wrap to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the trigger on close
      previouslyFocused?.focus();
    };
  }, [active]);

  return containerRef;
}

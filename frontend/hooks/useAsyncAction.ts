import { useCallback, useRef, useState } from "react";

/**
 * Wraps an async operation with automatic pending-state management.
 *
 * The returned `run` function:
 * - sets `pending` to `true` before calling `fn`
 * - calls `onError` (if provided) when `fn` throws
 * - always sets `pending` back to `false` in a `finally` block
 *
 * The `onError` reference is kept current via a ref so it never needs
 * to be in the `useCallback` dependency array — `run` has stable identity.
 *
 * Usage:
 *   const [saving, save] = useAsyncAction(
 *     (err) => toast.error(apiErrorMessage(err, "Failed to save."))
 *   );
 *
 *   async function handleSave() {
 *     await save(async () => {
 *       const result = await api.update(data);
 *       setState(result);
 *       toast.success("Saved!");
 *     });
 *   }
 */
export function useAsyncAction(
  onError?: (err: unknown) => void
): readonly [pending: boolean, run: (fn: () => Promise<void>) => Promise<void>] {
  const [pending, setPending] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError; // keep current without triggering re-renders

  const run = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    setPending(true);
    try {
      await fn();
    } catch (err) {
      onErrorRef.current?.(err);
    } finally {
      setPending(false);
    }
  }, []); // stable: no deps needed thanks to ref

  return [pending, run] as const;
}

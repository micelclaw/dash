/**
 * Copyright (c) 2026 Micelclaw (Víctor García Valdunciel)
 * All rights reserved.
 *
 * This file is part of Micelclaw OS and is proprietary software.
 * Unauthorized copying, modification, distribution, or use of this
 * file, via any medium, is strictly prohibited.
 *
 * See LICENSE in the root of this repository for full terms.
 * https://micelclaw.com
 */

// ─── useSensitiveInputs ─────────────────────────────────────────────
//
// Hook for managing form fields that hold secrets in component state
// (PIN, password, API key, etc.). Provides:
//   - Plain `useState`-shaped values via `values[name]` / `set(name, v)`
//   - `wipe()` clears all of them at once (call in catch blocks so the
//     secret doesn't sit in memory while the user reads the error)
//   - Automatic wipe on unmount, so navigating away from the section
//     doesn't leave secrets in the React tree (visible in DevTools /
//     heap snapshots)
//
// Originally inlined as ad-hoc cleanup useEffects in DatabaseSection
// and SecuritySection — extracted here to make the pattern reusable
// for any future section with sensitive inputs (Mail credentials,
// channel tokens, exec provider arg lists, etc.).

import { useCallback, useEffect, useRef, useState } from 'react';

export type SensitiveInputs<K extends string> = {
  /** Read the current value of a field. */
  values: Record<K, string>;
  /** Update one field. */
  set: (name: K, value: string) => void;
  /** Clear ALL fields at once. Use in catch blocks. */
  wipe: () => void;
  /**
   * Convenience wrapper: returns an `onChange` that updates the named
   * field directly from a React event (or a string when used with
   * controlled components that pass strings).
   */
  bind: (name: K) => {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement> | string) => void;
  };
};

/**
 * Manage one or more sensitive inputs. The keys are the field names;
 * the hook initialises every value to `""` and wipes them on unmount.
 *
 * @example
 * const pinForm = useSensitiveInputs(['pin', 'confirm', 'currentPassword']);
 * // ...
 * <input type="password" {...pinForm.bind('pin')} />
 * try {
 *   await setupPin(pinForm.values.pin, pinForm.values.currentPassword);
 *   pinForm.wipe();
 * } catch (err) {
 *   pinForm.wipe();
 *   toast.error(describeError(err, 'Failed'));
 * }
 */
export function useSensitiveInputs<K extends string>(names: readonly K[]): SensitiveInputs<K> {
  const initial = useRef<Record<K, string>>(
    Object.fromEntries(names.map((n) => [n, ''])) as Record<K, string>,
  );
  const [values, setValues] = useState<Record<K, string>>(initial.current);

  const set = useCallback((name: K, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const wipe = useCallback(() => {
    setValues(initial.current);
  }, []);

  // Wipe on unmount. We don't depend on `wipe` because it would
  // recreate the cleanup on each render — we want exactly one cleanup
  // tied to the mount lifecycle.
  useEffect(() => {
    return () => {
      // Set state may be a no-op after unmount but the closure-captured
      // `setValues` is stable; this clears the React-internal value
      // store synchronously during cleanup.
      setValues(initial.current);
    };
  }, []);

  const bind = useCallback(
    (name: K) => ({
      value: values[name],
      onChange: (e: React.ChangeEvent<HTMLInputElement> | string) => {
        const value = typeof e === 'string' ? e : e.target.value;
        setValues((prev) => ({ ...prev, [name]: value }));
      },
    }),
    [values],
  );

  return { values, set, wipe, bind };
}

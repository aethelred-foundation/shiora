/**
 * useDebounce — Generic debounce hook for search inputs and API calls.
 *
 * Delays updating the output value until `delayMs` milliseconds
 * have elapsed since the last change, preventing excessive
 * re-renders or network requests while the user is still typing.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Returns a debounced version of `value` that only updates
 * after the caller stops changing `value` for `delayMs` ms.
 *
 * @template T - The type of the value being debounced.
 * @param value - The rapidly changing input value.
 * @param delayMs - Debounce delay in milliseconds (default 300).
 * @returns The debounced value.
 *
 * @example
 * ```tsx
 * const [query, setQuery] = useState('');
 * const debouncedQuery = useDebounce(query, 350);
 *
 * useEffect(() => {
 *   // Only fires after user stops typing for 350ms
 *   searchAPI(debouncedQuery);
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}

/**
 * Returns a debounced callback that delays invocation until
 * `delayMs` ms have passed since the last call.
 *
 * Unlike `useDebounce` (which debounces a *value*), this hook
 * debounces a *function* — useful when you need to control
 * exactly when a side-effect fires.
 *
 * @param callback - The function to debounce.
 * @param delayMs - Debounce delay in milliseconds (default 300).
 * @returns A debounced version of the callback plus a `cancel` handle.
 *
 * @example
 * ```tsx
 * const [debouncedSearch, cancel] = useDebouncedCallback(
 *   (term: string) => fetchResults(term),
 *   400,
 * );
 *
 * <input onChange={(e) => debouncedSearch(e.target.value)} />
 * ```
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delayMs: number = 300,
): [(...args: Args) => void, () => void] {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  // Always point at the latest callback without re-creating the debounced fn.
  callbackRef.current = callback;

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const debounced = useCallback(
    (...args: Args) => {
      cancel();
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delayMs);
    },
    [delayMs, cancel],
  );

  // Clean up on unmount.
  useEffect(() => {
    return cancel;
  }, [cancel]);

  return [debounced, cancel];
}

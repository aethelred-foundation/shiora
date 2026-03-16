/**
 * useLocalStorage — Type-safe localStorage hook with SSR safety.
 *
 * Provides a `useState`-like API backed by `localStorage`.
 * Handles JSON serialization/deserialization, SSR hydration
 * (returns the initial value on the server), and gracefully
 * degrades when storage is unavailable or corrupted.
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Read, write, and remove a value in `localStorage` with full
 * type safety and SSR compatibility.
 *
 * @template T - The type of the stored value.
 * @param key - The `localStorage` key.
 * @param initialValue - Default value used when the key does not exist.
 * @returns A tuple of `[storedValue, setValue, removeValue]`.
 *
 * @example
 * ```ts
 * const [theme, setTheme, removeTheme] = useLocalStorage<'light' | 'dark'>('theme', 'light');
 * ```
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  // Lazy initializer — runs once; reads from storage only on the client.
  const [storedValue, setStoredValue] = useState<T>(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Keep a ref to the key so the effect always uses the latest value.
  const keyRef = useRef(key);
  keyRef.current = key;

  /**
   * Persist `storedValue` whenever it changes.
   * Using an effect instead of writing inside `setValue` avoids
   * double-writes when React batches state updates.
   */
  useEffect(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(keyRef.current, JSON.stringify(storedValue));
    } catch {
      // Storage full or private browsing — fail silently.
    }
  }, [storedValue]);

  /**
   * Listen for `storage` events so that other tabs/windows
   * that write to the same key will be reflected here.
   */
  useEffect(() => {
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key !== keyRef.current) return;
      try {
        const newValue = e.newValue !== null ? (JSON.parse(e.newValue) as T) : initialValue;
        setStoredValue(newValue);
      } catch {
        setStoredValue(initialValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [initialValue]);

  /** Update the stored value (accepts a raw value or an updater function). */
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        return nextValue;
      });
    },
    [],
  );

  /** Remove the key from localStorage and reset to `initialValue`. */
  const removeValue = useCallback(() => {
    setStoredValue(initialValue);
    /* istanbul ignore next -- SSR guard, untestable in JSDOM */
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(keyRef.current);
    } catch {
      // Fail silently.
    }
  }, [initialValue]);

  return [storedValue, setValue, removeValue];
}

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * useState that persists to localStorage. Survives page reloads and browser
 * restarts. Falls back to the default if storage is unavailable or the
 * stored value can't be parsed.
 */
export function usePersistedState<T>(
  key: string,
  defaultValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored) as T;
    } catch {
      // ignore — fall through to default
    }
    return defaultValue;
  });

  // Skip the initial write so we don't clobber other tabs unnecessarily.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore — quota exceeded, etc.
    }
  }, [key, value]);

  return [value, setValue];
}

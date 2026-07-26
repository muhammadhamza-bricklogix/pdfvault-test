"use client";

import { useEffect, useState } from "react";

/**
 * Delays updating the returned value until `ms` have passed without the
 * input changing. Useful for search inputs that drive expensive server
 * fetches — we don't want to hit the backend on every keystroke.
 */
export function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);

    return () => clearTimeout(timer);
  }, [value, ms]);

  return debounced;
}

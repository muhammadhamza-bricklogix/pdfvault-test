"use client";

import { useEffect } from "react";

/**
 * Attaches a `beforeunload` handler that triggers the browser's native
 * "Changes you may not be saved" prompt while `hasUnsavedChanges` is true.
 *
 * Browsers ignore custom messages on modern Chrome/Firefox/Safari for
 * security reasons; the prompt text is locale-specific and not
 * configurable. What we control is whether the prompt appears at all
 * (via calling `preventDefault` + setting `returnValue`).
 */
export function useUnsavedChangesWarning(hasUnsavedChanges: boolean) {
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Required by older browsers; modern ones ignore the string.
      event.returnValue = "";

      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
}

"use client";

import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

type PasswordRevealToggleProps = {
  revealed: boolean;
  onToggle: () => void;
  /**
   * `text-default-400` by default; override per-context (e.g. lighter shade
   * for dark auth panels).
   */
  className?: string;
};

/**
 * Small show/hide-password button. Lives inside the password field's
 * relative wrapper, absolutely positioned over the input's right edge so it
 * works against any wrapping component (HeroUI `Input`, plain `<input>`, etc.)
 * without poking at component-specific adornment slots.
 *
 * - `type="button"` so it never submits its parent form.
 * - `aria-pressed` so screen readers announce the state, not just the action.
 * - Eye / Eye-with-slash icons follow the iOS pattern users already
 *   recognise from password managers.
 */
export function PasswordRevealToggle({
  revealed,
  onToggle,
  className,
}: PasswordRevealToggleProps) {
  return (
    <button
      aria-label={revealed ? "Hide password" : "Show password"}
      aria-pressed={revealed}
      className={
        "absolute inset-y-0 right-0 z-10 flex items-center justify-center px-3 text-default-400 transition-colors hover:text-default-700 focus-visible:outline-none focus-visible:text-default-700" +
        (className ? ` ${className}` : "")
      }
      tabIndex={0}
      type="button"
      onClick={onToggle}
      // Prevent the click from stealing focus from the input — users expect
      // to keep typing after toggling.
      onMouseDown={(e) => e.preventDefault()}
    >
      <HugeiconsIcon icon={revealed ? ViewOffIcon : ViewIcon} size={16} />
    </button>
  );
}

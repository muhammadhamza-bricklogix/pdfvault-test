"use client";

import { useEffect, useId, useRef } from "react";

type OtpBoxesProps = {
  value: string;
  onChange: (next: string) => void;
  /**
   * Number of digit boxes. Defaults to 6 (standard Clerk email code
   * length). Kept configurable so signup / signin / any future 2FA
   * step with a different length can reuse the same component.
   */
  length?: number;
  /** Auto-focus the first empty box on mount. Defaults to true. */
  autoFocus?: boolean;
  /**
   * When true, the boxes render with a red border indicating a
   * validation / server error. Purely visual; parent still shows the
   * actual error text below.
   */
  hasError?: boolean;
  /**
   * `aria-describedby` for screen-reader linking to the error text.
   * Set on every box so the error is announced regardless of which
   * box is focused.
   */
  ariaDescribedBy?: string;
  /** Called with the full N-digit string when the user completes it.
   *  Useful for auto-submit UX ("no need to click Verify"). Fires
   *  exactly once per completion — subsequent edits fire onChange
   *  only. */
  onComplete?: (code: string) => void;
};

/**
 * 6-box (configurable) OTP input. Common keyboard/paste behaviour:
 *   - Typing a digit advances focus to the next box.
 *   - Backspace on an empty box focuses (and clears) the previous.
 *   - Left/Right arrows move between boxes.
 *   - Pasting a 6-digit code fills every box + calls onComplete.
 *   - Non-digit characters are stripped silently.
 *
 * Rendered as a horizontal row of individually-styled inputs so the
 * design matches the reference SS (each digit in its own rounded
 * box). Kept in `components/ui/form/` so both LoginCard and SignupCard
 * (and any future 2FA screen) can reuse it.
 */
export function OtpBoxes({
  value,
  onChange,
  length = 6,
  autoFocus = true,
  hasError = false,
  ariaDescribedBy,
  onComplete,
}: OtpBoxesProps) {
  const rowId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  // Normalise value to exactly `length` chars (right-pad with "" for
  // rendering; empty boxes show as blank). Filter non-digits so a
  // stray onChange from Clerk / autocomplete doesn't poison state.
  const digits = value
    .replace(/[^0-9]/g, "")
    .slice(0, length)
    .split("");

  useEffect(() => {
    if (!autoFocus) return;
    // Focus the first empty box, or the last box if all filled.
    const firstEmpty = digits.length < length ? digits.length : length - 1;

    refs.current[firstEmpty]?.focus();
    // Deliberately run once on mount only.
  }, []);

  const emit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const next = raw.replace(/[^0-9]/g, "");

    if (next.length === 0) {
      // Backspace inside an already-empty box is handled by keydown;
      // this fires when the user selects + deletes. Clear this slot.
      const chars = digits.slice();

      chars[index] = "";
      emit(chars.join("").replace(/^0+$/, "") || chars.join(""));

      return;
    }

    // Distribute (handles single-digit typing AND paste of multi-
    // digit strings landing on any box).
    const chars = digits.slice();

    for (let i = 0; i < next.length && index + i < length; i += 1) {
      chars[index + i] = next[i];
    }
    const joined = chars.slice(0, length).join("");

    emit(joined);

    // Advance focus to the box AFTER the last one written, capped at
    // the last box.
    const focusIndex = Math.min(index + next.length, length - 1);

    refs.current[focusIndex]?.focus();
    refs.current[focusIndex]?.select();
  };

  const handleKeyDown = (
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace") {
      if (!digits[index]) {
        // Empty box — focus previous and clear it too.
        if (index > 0) {
          const chars = digits.slice();

          chars[index - 1] = "";
          emit(chars.join(""));
          refs.current[index - 1]?.focus();
        }
        event.preventDefault();
      }
      // Non-empty: default backspace clears the current box, then
      // the next keydown (empty) will pull focus back.
    } else if (event.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
      event.preventDefault();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
      event.preventDefault();
    }
  };

  const handlePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/[^0-9]/g, "")
      .slice(0, length - index);

    if (!pasted) return;
    event.preventDefault();
    handleChange(index, pasted);
  };

  return (
    <div
      aria-describedby={ariaDescribedBy}
      aria-label="One-time verification code"
      className="flex justify-center gap-2 sm:gap-3"
      role="group"
    >
      {Array.from({ length }).map((_, i) => (
        <input
          key={`${rowId}-${i}`}
          ref={(el) => {
            refs.current[i] = el;
          }}
          aria-invalid={hasError ? true : undefined}
          aria-label={`Digit ${i + 1}`}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          className={`h-[56px] w-[44px] rounded-[10px] border-2 bg-white text-center text-[22px] font-semibold text-[#1a1c21] outline-none transition-colors focus-visible:border-[#f12c23] sm:h-[64px] sm:w-[52px] ${
            hasError ? "border-[#f12c23]" : "border-[#e1ebed]"
          }`}
          inputMode="numeric"
          maxLength={i === 0 ? length : 1}
          name={i === 0 ? "code" : undefined}
          pattern="[0-9]*"
          type="text"
          value={digits[i] ?? ""}
          onChange={(event) => handleChange(i, event.target.value)}
          onFocus={(event) => event.target.select()}
          onKeyDown={(event) => handleKeyDown(i, event)}
          onPaste={(event) => handlePaste(i, event)}
        />
      ))}
    </div>
  );
}

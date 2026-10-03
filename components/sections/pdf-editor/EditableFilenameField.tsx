"use client";

import { PencilEdit01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Click-to-edit filename field with fit-to-text sizing.
 *
 * View mode:
 *   - Renders the current name as text
 *   - Pencil icon button on the right
 *   - Field width = text width (no `flex-1` stretch)
 *
 * Edit mode (after user clicks the pencil):
 *   - Input becomes editable and auto-focuses with contents selected
 *   - Pencil is swapped for a tick (Save) button
 *   - Tick / Enter → commit rename, return to view mode
 *   - Escape → discard the change, return to view mode
 *   - Empty (trimmed) input disables the tick button so the name
 *     can never be persisted blank
 *   - QA 2026-10-03: validation also blocks commit on characters that
 *     break common filesystems (`/\\:*?"<>|`), control characters, and
 *     names longer than 200 chars (reserves headroom under the 255-char
 *     POSIX cap for the backend's `.pdf` extension and any
 *     collision suffixes). Invalid drafts show a red border, an
 *     `aria-invalid` state, a native `title` tooltip explaining why,
 *     and the tick button is disabled.
 *
 * `onCommit` is called with the trimmed new name. Extension handling
 * (e.g. re-appending `.pdf`) is the caller's responsibility — matches
 * the existing `commitRename` handlers.
 */

// Windows reserves these characters at the filesystem API level and
// macOS forbids `/`. Spaces, dashes, dots, and Unicode letters/digits
// remain allowed so users can type real-world document names like
// "My Document - 2024". Control chars (0x00-0x1F) are rejected too.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_FILENAME_CHARS = /[\\/:*?"<>|\x00-\x1f]/;
const MAX_FILENAME_LENGTH = 200;

type FilenameValidation = { valid: true } | { valid: false; reason: string };

function validateFilename(name: string): FilenameValidation {
  const trimmed = name.trim();

  if (!trimmed) {
    return { reason: "Name cannot be empty", valid: false };
  }
  if (trimmed.length > MAX_FILENAME_LENGTH) {
    return {
      reason: `Name is too long (max ${MAX_FILENAME_LENGTH} characters)`,
      valid: false,
    };
  }
  if (FORBIDDEN_FILENAME_CHARS.test(trimmed)) {
    return {
      reason: `Name cannot contain any of: \\ / : * ? " < > |`,
      valid: false,
    };
  }
  // Trailing dots / spaces trip Windows filesystems silently; backend
  // strips them, user ends up with a different name than they typed.
  if (/[. ]+$/.test(trimmed)) {
    return {
      reason: "Name cannot end with a space or dot",
      valid: false,
    };
  }

  return { valid: true };
}
export function EditableFilenameField({
  value,
  disabled,
  ariaLabel = "Document name",
  className = "",
  fontSizeClass = "text-[14px]",
  onCommit,
}: {
  /** Current displayed name (extension already stripped by caller). */
  value: string;
  /** Disabled state — no file loaded / read-only. */
  disabled?: boolean;
  ariaLabel?: string;
  /** Extra classes for the outer container (max-width, hidden-md, etc). */
  className?: string;
  /** Text sizing utility applied to both the display span + input. */
  fontSizeClass?: string;
  /** Called with the trimmed new name when the user commits. */
  onCommit: (nextName: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number | null>(null);

  // `draft` is used ONLY while the input is mounted (isEditing === true).
  // When not editing, the display span reads directly from `value`, so
  // a stale draft is invisible to the user — it gets refreshed to the
  // current `value` inside `enterEdit` on the next Rename click. This
  // avoids a setState-in-effect anti-pattern that would sync draft on
  // every parent re-render.

  // Measure the sizer span so the input matches text width. Runs on
  // draft change so the input grows/shrinks with typing.
  useLayoutEffect(() => {
    if (sizerRef.current) {
      const w = sizerRef.current.getBoundingClientRect().width;

      setInputWidth(Math.max(24, Math.ceil(w) + 4));
    }
  }, [draft, isEditing]);

  const enterEdit = () => {
    if (disabled) return;
    setDraft(value);
    setIsEditing(true);
    // Defer focus until after render so the input actually exists.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const cancelEdit = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const validation = validateFilename(draft);
  const canCommit = validation.valid;
  const validationReason = validation.valid ? null : validation.reason;

  const commit = () => {
    const trimmed = draft.trim();

    // Blank + invalid guard — never persist a bad name. Silently
    // cancel on blank (preserves the original value); keep the user
    // in edit mode on validation failure so they can see the red
    // border + tooltip and fix the name. The tick button is also
    // disabled when `canCommit === false`, so this handles the
    // Enter-key path.
    if (!trimmed) {
      cancelEdit();

      return;
    }
    if (!validation.valid) {
      return;
    }

    if (trimmed !== value) {
      onCommit(trimmed);
    }
    setIsEditing(false);
  };

  const showInvalid = isEditing && !canCommit && draft.length > 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 transition-colors ${
        showInvalid
          ? "border-rose-500"
          : isEditing
            ? "border-[#f12c23]"
            : disabled
              ? "border-default-200"
              : "border-default-300 hover:border-default-400"
      } ${disabled ? "opacity-50" : ""} ${className}`}
      title={validationReason ?? undefined}
    >
      {/* Invisible sizer that mirrors input styles + content so we can
          measure natural text width and apply it back to the input.
          Using a span outside the visible flow means the input width
          tracks the actual rendered text of whichever font/size is
          currently applied. */}
      <span
        ref={sizerRef}
        aria-hidden
        className={`pointer-events-none invisible absolute whitespace-pre font-medium ${fontSizeClass}`}
      >
        {(isEditing ? draft : value) || " "}
      </span>

      {isEditing ? (
        <input
          ref={inputRef}
          aria-invalid={showInvalid || undefined}
          aria-label={ariaLabel}
          className={`min-w-0 bg-transparent font-medium outline-none ${fontSizeClass} ${
            showInvalid
              ? "text-rose-700"
              : "text-[var(--color-foreground)]"
          }`}
          disabled={disabled}
          maxLength={MAX_FILENAME_LENGTH + 50}
          style={{ width: inputWidth ?? undefined }}
          type="text"
          value={draft}
          onBlur={commit}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
        />
      ) : (
        <span
          className={`truncate font-medium text-[var(--color-foreground)] ${fontSizeClass} ${disabled ? "" : "cursor-pointer"}`}
          style={{ maxWidth: inputWidth ?? undefined }}
          title={value}
          onClick={enterEdit}
        >
          {value}
        </span>
      )}

      {isEditing ? (
        <button
          aria-label="Save name"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-[#f12c23] transition-colors hover:bg-[#f12c23]/10 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canCommit}
          type="button"
          // onMouseDown prevents the input's onBlur from firing first
          // and swallowing our click — Blur-then-click would cancel
          // the edit via the blur handler's commit path but with the
          // OLD draft (React state batching) — leading to a UX where
          // the tick "does nothing" if clicked immediately after typing.
          onClick={commit}
          onMouseDown={(e) => e.preventDefault()}
        >
          <HugeiconsIcon icon={Tick01Icon} size={14} strokeWidth={2.2} />
        </button>
      ) : (
        <button
          aria-label="Rename document"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-default-400 transition-colors hover:bg-default-100 hover:text-default-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={disabled}
          type="button"
          onClick={enterEdit}
        >
          <HugeiconsIcon icon={PencilEdit01Icon} size={14} strokeWidth={1.8} />
        </button>
      )}
    </div>
  );
}

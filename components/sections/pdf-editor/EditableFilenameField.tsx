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
 *
 * `onCommit` is called with the trimmed new name. Extension handling
 * (e.g. re-appending `.pdf`) is the caller's responsibility — matches
 * the existing `commitRename` handlers.
 */
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

  const commit = () => {
    const trimmed = draft.trim();

    // Empty guard — never persist a blank name. Silently cancel;
    // the tick button is also disabled below so this branch is a
    // belt-and-braces for the Enter-key path.
    if (!trimmed) {
      cancelEdit();

      return;
    }

    if (trimmed !== value) {
      onCommit(trimmed);
    }
    setIsEditing(false);
  };

  const canCommit = draft.trim().length > 0;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 transition-colors ${
        isEditing
          ? "border-[#f12c23]"
          : disabled
            ? "border-default-200"
            : "border-default-300 hover:border-default-400"
      } ${disabled ? "opacity-50" : ""} ${className}`}
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
          aria-label={ariaLabel}
          className={`min-w-0 bg-transparent font-medium text-[var(--color-foreground)] outline-none ${fontSizeClass}`}
          disabled={disabled}
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

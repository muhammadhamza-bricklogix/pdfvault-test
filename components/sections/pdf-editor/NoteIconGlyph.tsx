"use client";

import {
  darkenHex,
  getNoteIconDef,
  NOTE_COLORS,
  type NoteIconId,
} from "@/lib/client/pdf-editor/annotation-notes";

/** SVG preview of a sticky-note marker, matching what is drawn on the page. */
export function NoteIconGlyph({
  color,
  icon,
  size = 24,
}: {
  color: string;
  icon: NoteIconId;
  size?: number;
}) {
  const def = getNoteIconDef(icon);

  return (
    <svg
      aria-hidden
      className="shrink-0"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <path
        d={def.body}
        fill={color}
        stroke={darkenHex(color)}
        strokeLinejoin="round"
        strokeWidth={1}
      />
      {def.detail ? (
        <path
          d={def.detail}
          fill="none"
          stroke="#1F2937"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.6}
        />
      ) : null}
    </svg>
  );
}

export function NoteColorSwatches({
  compact = false,
  onChange,
  value,
}: {
  compact?: boolean;
  onChange: (color: string) => void;
  value: string;
}) {
  return (
    <div
      aria-label="Note colour"
      className={`flex flex-wrap p-1 ${compact ? "gap-1.5" : "gap-2"}`}
      role="radiogroup"
    >
      {NOTE_COLORS.map((c) => {
        const selected = c.value.toLowerCase() === value.toLowerCase();

        return (
          <button
            key={c.value}
            aria-checked={selected}
            aria-label={c.label}
            className={`${compact ? "h-6 w-6" : "h-7 w-7 sm:h-8 sm:w-8"} shrink-0 cursor-pointer rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
              selected
                ? "ring-2 ring-slate-900 ring-offset-2"
                : "hover:scale-110"
            }`}
            role="radio"
            style={{
              backgroundColor: c.value,
              borderColor: darkenHex(c.value),
            }}
            title={c.label}
            type="button"
            onClick={() => onChange(c.value)}
          />
        );
      })}
    </div>
  );
}

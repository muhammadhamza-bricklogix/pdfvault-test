"use client";

import type { FieldProps } from "./types";

import {
  FieldError,
  Input,
  Label,
  TextField as HeroTextField,
} from "@heroui/react";
import { useState } from "react";

import { useFormEditorStore } from "@/lib/client/stores";
import { toast } from "@/lib/shared/utils/toast";

import { pdfRectToCss } from "./types";

/** IRS W-9: SSN and EIN are mutually exclusive. Typing in one clears the
 *  other so we never end up in a both-filled state. */
function clearOtherTin(otherId: "ein", otherLabel: string) {
  const state = useFormEditorStore.getState();

  if (state.values[otherId]) {
    state.setValue(otherId, "");
    toast.info({
      title: `${otherLabel} cleared`,
      description: "The W-9 accepts either SSN or EIN — not both.",
    });
  }
}

function formatSsn(digits: string): string {
  const d = digits.slice(0, 9);

  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;

  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function maskSsn(formatted: string): string {
  if (formatted.length < 11) return formatted;

  return `${formatted.slice(0, 3)}-**-${formatted.slice(7)}`;
}

/**
 * Expand each segment's bounding rect into one rect per character box.
 * The W-9 prints discrete digit boxes inside each segment; we render one
 * single-character input per box so digits land precisely in the cells.
 */
function expandSegmentsToBoxes(
  segments: NonNullable<FieldProps["field"]["segments"]>,
) {
  return segments.flatMap((segment, segIndex) => {
    const cellWidth = segment.rect.w / segment.length;

    return Array.from({ length: segment.length }, (_, i) => ({
      segIndex,
      digitIndex: i,
      rect: {
        ...segment.rect,
        x: segment.rect.x + cellWidth * i,
        w: cellWidth,
      },
    }));
  });
}

export function SsnField({ field, mode, page }: FieldProps) {
  const value = useFormEditorStore((s) => s.values[field.id] ?? "");
  const error = useFormEditorStore((s) => s.errors[field.id]);
  const setValue = useFormEditorStore((s) => s.setValue);

  const [focused, setFocused] = useState(false);

  const digits = value.replace(/\D/g, "").slice(0, 9);
  const formatted = formatSsn(digits);
  const sidebarDisplay = focused || !formatted ? formatted : maskSsn(formatted);

  const handleSidebarChange = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, 9);

    if (next.length > 0) clearOtherTin("ein", "EIN");
    setValue(field.id, formatSsn(next));
  };

  if (mode === "overlay") {
    if (!page || !field.segments?.length) return null;

    const boxes = expandSegmentsToBoxes(field.segments);

    // Middle SSN segment (index 1, positions 4-5) is masked when not focused.
    const overallIndexOf = (segIndex: number, digitIndex: number) => {
      let n = 0;

      for (let s = 0; s < segIndex; s++) n += field.segments![s]!.length;

      return n + digitIndex;
    };

    const handleDigitChange = (overallIndex: number, raw: string) => {
      const newChar = raw.replace(/\D/g, "").slice(-1);
      const arr = digits.split("");

      while (arr.length < 9) arr.push("");
      arr[overallIndex] = newChar;
      const next = arr.join("").replace(/(?<!\d)\s/g, "");

      if (newChar) clearOtherTin("ein", "EIN");
      setValue(field.id, formatSsn(next.replace(/[^\d]/g, "")));

      // Auto-advance focus to the next box when a digit is typed.
      if (newChar && overallIndex < 8) {
        const nextEl = document.getElementById(
          `ssn-box-${overallIndex + 1}`,
        ) as HTMLInputElement | null;

        nextEl?.focus();
      }
    };

    return (
      <>
        {boxes.map(({ segIndex, digitIndex, rect }) => {
          const css = pdfRectToCss(rect, page);
          const overall = overallIndexOf(segIndex, digitIndex);
          let char = digits[overall] ?? "";

          // Mask the middle 2 digits when this whole field isn't focused.
          if (!focused && segIndex === 1 && char) char = "*";

          return (
            <input
              key={`ssn-box-${overall}`}
              aria-invalid={Boolean(error)}
              aria-label={`SSN digit ${overall + 1}`}
              autoComplete="off"
              className="pointer-events-auto absolute rounded-[1px] border border-yellow-500/40 bg-yellow-100/50 p-0 text-center text-black caret-[var(--color-accent)] outline-none transition-colors hover:bg-yellow-100/70 focus:border-[var(--color-accent)] focus:bg-yellow-100/80 aria-[invalid=true]:border-danger-500"
              id={`ssn-box-${overall}`}
              inputMode="numeric"
              maxLength={1}
              style={{
                fontSize: Math.max(css.height * 0.6, 10),
                height: css.height,
                left: css.left,
                top: css.top,
                width: css.width,
              }}
              type="text"
              value={char}
              onBlur={() => setFocused(false)}
              onChange={(e) => handleDigitChange(overall, e.target.value)}
              onFocus={() => setFocused(true)}
              onKeyDown={(e) => {
                // Backspace on empty box → focus previous.
                if (e.key === "Backspace" && !digits[overall] && overall > 0) {
                  e.preventDefault();
                  const prev = document.getElementById(
                    `ssn-box-${overall - 1}`,
                  ) as HTMLInputElement | null;

                  prev?.focus();
                }
              }}
            />
          );
        })}
      </>
    );
  }

  return (
    <HeroTextField isInvalid={Boolean(error)} name={field.id}>
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      <Input
        aria-label="Social Security Number"
        id={`sidebar-${field.id}`}
        inputMode="numeric"
        placeholder="123-45-6789"
        value={sidebarDisplay}
        onBlur={() => setFocused(false)}
        onChange={(e) => handleSidebarChange(e.target.value)}
        onFocus={() => setFocused(true)}
      />
      {error ? <FieldError>{error}</FieldError> : null}
    </HeroTextField>
  );
}

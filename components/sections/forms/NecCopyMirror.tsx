"use client";

import type { RenderedPageInfo } from "./FormCanvas";
import type { FormField } from "@/lib/shared/types/forms.types";

import { useFormEditorStore } from "@/lib/client/stores";

import { overlayFontSize, pdfRectToCss } from "./fields/types";

type NecCopyMirrorProps = {
  /** Fields for ONE copy, already re-pointed at that copy's page. */
  fields: FormField[];
  page: RenderedPageInfo;
};

/**
 * Read-only mirror of Copy A, drawn over Copies 1, B and 2.
 *
 * All four copies of the 1099-NEC carry identical data, but only Copy A is
 * fillable (see `NecFormFieldsPortal`). These pages therefore render the
 * values as plain text — no inputs, no yellow tint, nothing focusable — so
 * the user can see every copy is populated without being offered four
 * places to edit one underlying value.
 *
 * Geometry and type size are computed with the same helpers the editable
 * fields use, so a value sits in exactly the same spot on every copy.
 */
export function NecCopyMirror({ fields, page }: NecCopyMirrorProps) {
  const values = useFormEditorStore((s) => s.values);

  return (
    <>
      {fields.map((field) => {
        const raw = values[field.id] ?? "";

        if (!raw) return null;

        const css = pdfRectToCss(field.rect, page);
        const box = {
          height: css.height,
          left: css.left,
          top: css.top,
          width: css.width,
        };

        if (field.type === "checkbox") {
          // Same truthiness `CheckboxField` uses.
          if (raw !== "true" && raw !== "1" && raw !== "X") return null;

          return (
            <span
              key={field.id}
              className="absolute flex items-center justify-center font-bold leading-none text-black"
              style={{
                ...box,
                fontSize: overlayFontSize(field.rect, css.scale, {
                  allowOverflow: true,
                  maxPt: 12,
                  ratio: 1.35,
                }),
              }}
            >
              ✓
            </span>
          );
        }

        if (field.multiline) {
          return (
            <span
              key={field.id}
              className="absolute overflow-hidden px-1 leading-tight whitespace-pre-wrap text-black"
              style={{
                ...box,
                fontSize: overlayFontSize(field.rect, css.scale, {
                  maxPt: 13,
                  override: field.overlayFontSize,
                  ratio: 0.45,
                }),
              }}
            >
              {raw}
            </span>
          );
        }

        return (
          <span
            key={field.id}
            // flex + items-center reproduces how an <input> centres its text
            // vertically inside a fixed-height box.
            className="absolute flex items-center overflow-hidden px-1 leading-none text-black"
            style={{
              ...box,
              fontSize: overlayFontSize(field.rect, css.scale, {
                maxPt: 15,
                override: field.overlayFontSize,
                ratio: 0.95,
              }),
            }}
          >
            {raw}
          </span>
        );
      })}
    </>
  );
}

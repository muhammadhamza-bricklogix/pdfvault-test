"use client";

import type { FieldProps } from "./types";

import { Button, Label } from "@heroui/react";
import { useState } from "react";

import { useFormEditorStore } from "@/lib/client/stores";

import { SignatureModal } from "../SignatureModal";

import { pdfRectToCss } from "./types";

// Signature layout — matches pdfguru's convention: the signature (or the
// "Sign" button) sits at the START of the printed signature line with a
// margin so it doesn't crash into the "Sign Here" label at the left edge
// or the divider line at the right. 20% left margin was chosen to visually
// clear the "Sign Here" label; the rendered signature/button then occupies
// 80% of the field width so it stays comfortably within the underline.
const SIGNATURE_LEFT_MARGIN_PCT = 0.2;
const SIGNATURE_INNER_WIDTH_PCT = 1 - SIGNATURE_LEFT_MARGIN_PCT;
// Once the user has actually signed, drop the visible box to the bottom
// portion of the field so the signature sits on the signature line without
// bleeding hard into the text row above it. Unsigned = full height (bigger
// tap target for "Sign here").
const SIGNED_HEIGHT_PCT = 0.85;

export function SignatureField({ field, mode, page }: FieldProps) {
  const signatureKey = useFormEditorStore((s) => s.signatureKey);
  const signaturePreview = useFormEditorStore((s) => s.signaturePreview);
  const error = useFormEditorStore((s) => s.errors[field.id]);

  const [isOpen, setIsOpen] = useState(false);

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);
    const innerLeft = css.left + css.width * SIGNATURE_LEFT_MARGIN_PCT;
    const innerWidth = css.width * SIGNATURE_INNER_WIDTH_PCT;
    const signedHeight = css.height * SIGNED_HEIGHT_PCT;
    const signedTop = css.top + (css.height - signedHeight);

    return (
      <>
        {/* Yellow highlight rect — sits behind the button / signature so
            the whole signature line reads as "editable" even though only
            the inner 80% is the actual click target. Ignores clicks so
            they fall through to the button below. Once signed, shrink +
            drop to the bottom so it doesn't crash into the text above. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute rounded-[2px] border transition-colors ${
            signatureKey
              ? "border-success-400/40 bg-success-50/40"
              : "border-yellow-500/40 bg-yellow-100/40"
          } ${error ? "ring-2 ring-danger-500" : ""}`}
          style={{
            height: signaturePreview ? signedHeight : css.height,
            left: css.left,
            top: signaturePreview ? signedTop : css.top,
            width: css.width,
          }}
        />

        {signaturePreview ? (
          <button
            aria-label="Edit signature"
            className="pointer-events-auto absolute cursor-pointer bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            style={{
              height: signedHeight,
              left: innerLeft,
              top: signedTop,
              width: innerWidth,
            }}
            type="button"
            onClick={() => setIsOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, not optimizable */}
            <img
              alt="Your signature"
              className="h-full w-full object-contain object-left"
              draggable={false}
              src={signaturePreview}
            />
          </button>
        ) : (
          <button
            aria-invalid={Boolean(error)}
            aria-label="Open signature panel"
            className={`pointer-events-auto absolute inline-flex items-center justify-center gap-1 rounded-md border-2 border-dashed border-[var(--color-accent)]/70 bg-white/90 px-2 text-[11px] font-semibold text-[var(--color-accent)] shadow-sm outline-none transition-colors hover:bg-[var(--color-accent)]/10 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
              error ? "ring-2 ring-danger-500" : ""
            }`}
            style={{
              height: css.height,
              left: innerLeft,
              top: css.top,
              width: innerWidth,
            }}
            type="button"
            onClick={() => setIsOpen(true)}
          >
            {signatureKey ? "✓ Signed — edit" : "Sign here"}
          </button>
        )}

        <SignatureModal isOpen={isOpen} onOpenChange={setIsOpen} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-medium text-default-700 dark:text-default-300">
        {field.label}
      </Label>
      {signaturePreview ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL preview
        <img
          alt="Your signature"
          className="h-20 w-full cursor-pointer rounded-lg border border-default-200 bg-white object-contain p-2 dark:border-default-700"
          src={signaturePreview}
          onClick={() => setIsOpen(true)}
        />
      ) : null}
      <Button
        size="sm"
        variant={signatureKey ? "secondary" : "primary"}
        onPress={() => setIsOpen(true)}
      >
        {signatureKey ? "Edit signature" : "Add signature"}
      </Button>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <SignatureModal isOpen={isOpen} onOpenChange={setIsOpen} />
    </div>
  );
}

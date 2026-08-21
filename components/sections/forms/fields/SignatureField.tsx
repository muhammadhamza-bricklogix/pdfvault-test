"use client";

import type { FieldProps } from "./types";

import { Button, Label } from "@heroui/react";
import { useState } from "react";

import { useFormEditorStore } from "@/lib/client/stores";

import { SignatureModal } from "../SignatureModal";

import { pdfRectToCss } from "./types";

export function SignatureField({ field, mode, page }: FieldProps) {
  const signatureKey = useFormEditorStore((s) => s.signatureKey);
  const signaturePreview = useFormEditorStore((s) => s.signaturePreview);
  const error = useFormEditorStore((s) => s.errors[field.id]);

  const [isOpen, setIsOpen] = useState(false);

  if (mode === "overlay") {
    if (!page) return null;

    const css = pdfRectToCss(field.rect, page);

    return (
      <>
        {signaturePreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL, not optimizable
          <img
            alt="Your signature"
            className="pointer-events-auto absolute cursor-pointer object-contain"
            src={signaturePreview}
            style={{
              height: css.height,
              left: css.left,
              top: css.top,
              width: css.width,
            }}
            onClick={() => setIsOpen(true)}
          />
        ) : (
          <button
            aria-invalid={Boolean(error)}
            aria-label="Open signature panel"
            className={`pointer-events-auto absolute flex items-center justify-center rounded-[2px] border-2 border-dashed text-[11px] font-medium outline-none transition-colors ${
              signatureKey
                ? "border-success-400/40 bg-success-50/40 text-success-700"
                : "border-yellow-500/60 bg-yellow-100/60 text-[var(--color-accent)] hover:bg-yellow-100/80"
            } ${error ? "ring-2 ring-danger-500" : ""}`}
            style={{
              height: css.height,
              left: css.left,
              top: css.top,
              width: css.width,
            }}
            type="button"
            onClick={() => setIsOpen(true)}
          >
            {signatureKey ? "✓ Signed" : "Click to sign"}
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

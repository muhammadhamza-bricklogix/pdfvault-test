"use client";

import type { FieldProps } from "./types";

import { useFormEditorStore } from "@/lib/client/stores";

import { fieldIsVisible } from "../visibility";

type ConditionalFieldProps = FieldProps & {
  children: React.ReactNode;
};

/**
 * Wrapper that renders `children` only when the wrapped field's `showIf`
 * predicate is satisfied by the current store values. Used for things like
 * the LLC-letter input that appears only when "LLC" is the chosen
 * classification.
 */
export function ConditionalField({ field, children }: ConditionalFieldProps) {
  const values = useFormEditorStore((s) => s.values);

  if (!fieldIsVisible(field, values)) return null;

  return <>{children}</>;
}

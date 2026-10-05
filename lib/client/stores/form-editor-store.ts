"use client";

import type { FormSchema, FormSession } from "@/lib/shared/types/forms.types";

import { create } from "zustand";

import { fieldIsVisible } from "@/components/sections/forms/visibility";

/**
 * Drops the value of any field whose `showIf` is no longer satisfied.
 *
 * Hiding a field in the overlay is not enough on its own: the value stays in
 * the store, gets autosaved, and is stamped into a PDF that no longer shows the
 * field it came from. Typing a phone type beside "Other" and then picking
 * "Work" would leave the old text on the printed form.
 *
 * Only reached from `setValue`, the user-edit path. `setValues` is deliberately
 * left alone — it is how a resumed draft is restored, and a dependent value can
 * legitimately arrive before the field that controls it.
 */
function pruneHiddenValues(
  schema: FormSchema | null,
  values: Record<string, string>,
): Record<string, string> {
  if (!schema) return values;

  let next = values;

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!field.showIf) continue;
      if (!next[field.id]) continue;
      if (fieldIsVisible(field, next)) continue;

      if (next === values) next = { ...values };
      delete next[field.id];
    }
  }

  return next;
}

type FormEditorState = {
  // Server state
  sessionId: string | null;
  schema: FormSchema | null;
  pdfUrl: string | null;
  signatureKey: string | null;
  /**
   * Browser-local data URL of the most recent signature so we can render
   * it on the PDF overlay without re-fetching from the backend. Cleared on
   * reset; not persisted across page refreshes.
   */
  signaturePreview: string | null;
  finalizedUrl: string | null;

  // User state
  values: Record<string, string>;
  errors: Record<string, string>;

  // Actions
  hydrateFromSession: (session: FormSession) => void;
  setValue: (fieldId: string, value: string) => void;
  setValues: (values: Record<string, string>) => void;
  setErrors: (errors: Record<string, string>) => void;
  clearError: (fieldId: string) => void;
  setSignatureKey: (key: string | null) => void;
  setSignaturePreview: (dataUrl: string | null) => void;
  setFinalizedUrl: (url: string | null) => void;
  reset: () => void;
};

const initialState = {
  sessionId: null,
  schema: null,
  pdfUrl: null,
  signatureKey: null,
  signaturePreview: null,
  finalizedUrl: null,
  values: {},
  errors: {},
};

export const useFormEditorStore = create<FormEditorState>()((set) => ({
  ...initialState,

  hydrateFromSession: (session) =>
    set((s) => ({
      sessionId: session.id,
      schema: session.schema,
      pdfUrl: session.pdfUrl,
      signatureKey: session.signatureKey,
      // Preserve a signature preview that the resume path may have
      // restored before this promise resolved. Same race guard as the
      // `values` merge below — a fresh session has no preview, so
      // keeping the existing one costs nothing; on a resume we NEED
      // to keep the restored data URL or the PDF overlay shows the
      // "Sign here" placeholder again (QA 2026-08-28).
      signaturePreview: s.signaturePreview ?? null,
      finalizedUrl: session.finalizedUrl,
      // MERGE session.values into whatever `values` already holds,
      // with EXISTING values winning on collisions. Previously this
      // REPLACED `values` with `session.values ?? {}`, which raced
      // the `?resumeDocId=<id>` restore path in `W9EditorBootstrap`:
      // if `resumePromise` set the restored form values (via
      // `setValues(...)`) BEFORE the parallel `sessionPromise`
      // finished, this hydrate wiped them with `{}` and the user
      // saw a blank form on reopen from Dashboard → My PDFs
      // (QA report 2026-08-28). Fresh sessions have no values so
      // this is a no-op in the common case; on the resume race,
      // whichever promise ran first wins — resume-first keeps its
      // restored values (session merges nothing on top), session-
      // first seeds `{}` and resume's later `setValues(...)` lands
      // the restored values.
      values: { ...(session.values ?? {}), ...s.values },
      errors: {},
    })),

  setValue: (fieldId, value) =>
    set((s) => ({
      values: pruneHiddenValues(s.schema, { ...s.values, [fieldId]: value }),
      errors: { ...s.errors, [fieldId]: "" },
    })),

  setValues: (values) =>
    set((s) => ({
      values: { ...s.values, ...values },
    })),

  setErrors: (errors) => set({ errors }),

  clearError: (fieldId) =>
    set((s) => {
      if (!s.errors[fieldId]) return s;
      const next = { ...s.errors };

      delete next[fieldId];

      return { errors: next };
    }),

  setSignatureKey: (signatureKey) => set({ signatureKey }),
  setSignaturePreview: (signaturePreview) => set({ signaturePreview }),
  setFinalizedUrl: (finalizedUrl) => set({ finalizedUrl }),

  reset: () => set(initialState),
}));

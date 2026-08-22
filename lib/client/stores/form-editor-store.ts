"use client";

import type { FormSchema, FormSession } from "@/lib/shared/types/forms.types";

import { create } from "zustand";

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
    set({
      sessionId: session.id,
      schema: session.schema,
      pdfUrl: session.pdfUrl,
      signatureKey: session.signatureKey,
      finalizedUrl: session.finalizedUrl,
      values: session.values ?? {},
      errors: {},
    }),

  setValue: (fieldId, value) =>
    set((s) => ({
      values: { ...s.values, [fieldId]: value },
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

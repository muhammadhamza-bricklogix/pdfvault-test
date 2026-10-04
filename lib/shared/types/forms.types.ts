/**
 * Form-filler types shared between the schema, the editor store, and the
 * service layer. A `FormSchema` is what describes the W-9 (or any other
 * future form) once raw AcroForm fields have been annotated with labels,
 * types, sections, and conditional-visibility rules.
 */

export type FormFieldType =
  | "text"
  | "ssn"
  | "ein"
  | "date"
  | "radio"
  | "checkbox"
  | "signature";

/** Coordinates of a field on the rendered PDF (PDF user space, bottom-left). */
export type FormFieldRect = {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type FormFieldOption = {
  id: string;
  label: string;
  /** Per-option rect for overlay hit-areas (e.g. one checkbox per radio choice). */
  rect?: FormFieldRect;
};

/**
 * `showIf` enables simple equality-based conditional rendering. Example:
 *   showIf: { c1_1: "llc" }  → only show this field if `values.c1_1 === "llc"`.
 */
export type ShowIf = Record<string, string>;

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  pdfRef: string;
  rect: FormFieldRect;
  options?: FormFieldOption[];
  /**
   * Per-segment rects for fields whose digits are typed into individual
   * boxes on the PDF (SSN: 3-2-4, EIN: 2-7). The lengths of the segments
   * determine how the value is sliced.
   */
  segments?: { rect: FormFieldRect; length: number }[];
  showIf?: ShowIf;
  format?: string;
  maxLength?: number;
  helpText?: string;
  /** Mirrors the AcroForm widget's Multiline flag — `TextField` renders a
   * `<textarea>` when true, an `<input>` otherwise. */
  multiline?: boolean;
  /**
   * Overlay-only font size override in PDF points. When set, TextField
   * skips the height-derived formula and uses this as the base size,
   * still multiplying by the page scale so the text zooms with the page.
   * Needed for tall multi-line rects (e.g. the W-9 requester address
   * block, h: 38) where the auto-scaled font would dwarf the
   * neighbouring one-liners.
   */
  overlayFontSize?: number;
  /**
   * Field with no AcroForm widget behind it. The IRS leaves two blocks on
   * the 1099-NEC shaded and blank, so there is nothing to `setText` into;
   * both stampers draw the value onto the page instead. Keep `pdfRef`
   * empty for these.
   */
  freeText?: boolean;
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormSchema = {
  id: string;
  label: string;
  pdfUrl: string;
  pageCount: number;
  sections: FormSection[];
};

/** Server-side session state for a single in-progress fill. */
export type FormSession = {
  id: string;
  formId: string;
  schema: FormSchema;
  pdfUrl: string;
  values: Record<string, string>;
  signatureKey: string | null;
  finalizedUrl: string | null;
  updatedAt: string;
};

export type StartFormSessionInput = {
  formId: string;
};

export type UploadSignatureInput = {
  sessionId: string;
  blob: Blob;
};

export type UploadSignatureResult = {
  signatureKey: string;
};

/**
 * Finalize now carries the full payload — the backend no longer stores
 * intermediate values, so we hand it everything in one shot.
 */
export type FinalizeFormSessionInput = {
  sessionId: string;
  values: Record<string, string>;
  signatureKey: string | null;
};

export type FinalizeFormSessionResult = {
  downloadUrl: string;
};

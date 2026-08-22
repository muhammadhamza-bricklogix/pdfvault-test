"use client";

import type { RenderedPageInfo } from "./FormCanvas";
import type { FormField } from "@/lib/shared/types/forms.types";

import { useFormEditorStore } from "@/lib/client/stores";

import { CheckboxField } from "./fields/CheckboxField";
import { DateField } from "./fields/DateField";
import { EinField } from "./fields/EinField";
import { RadioGroupField } from "./fields/RadioGroupField";
import { SignatureField } from "./fields/SignatureField";
import { SsnField } from "./fields/SsnField";
import { TextField } from "./fields/TextField";
import { fieldIsVisible } from "./visibility";

type FormFieldOverlayProps = {
  /** Fields that live on a single page. Caller filters by page. */
  fields: FormField[];
  /** Rendered-info for the page this overlay is for. */
  page: RenderedPageInfo;
};

/**
 * Renders the editable controls for a single page's fields, positioned
 * absolutely over that page's canvas. Wrapped by `<PdfPage>` in
 * `FormCanvas` so each page has its own coordinate space.
 */
export function FormFieldOverlay({ fields, page }: FormFieldOverlayProps) {
  const values = useFormEditorStore((s) => s.values);

  return (
    <>
      {fields
        .filter((f) => fieldIsVisible(f, values))
        .map((field) => {
          const props = { field, mode: "overlay" as const, page };

          switch (field.type) {
            case "text":
              return <TextField key={field.id} {...props} />;
            case "ssn":
              return <SsnField key={field.id} {...props} />;
            case "ein":
              return <EinField key={field.id} {...props} />;
            case "date":
              return <DateField key={field.id} {...props} />;
            case "checkbox":
              return <CheckboxField key={field.id} {...props} />;
            case "signature":
              return <SignatureField key={field.id} {...props} />;
            case "radio":
              return <RadioGroupField key={field.id} {...props} />;
            default:
              return null;
          }
        })}
    </>
  );
}

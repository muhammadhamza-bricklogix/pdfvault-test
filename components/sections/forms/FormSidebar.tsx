"use client";

import type { FormField, FormSection } from "@/lib/shared/types/forms.types";

import { useFormEditorStore } from "@/lib/client/stores";

import { CheckboxField } from "./fields/CheckboxField";
import { DateField } from "./fields/DateField";
import { EinField } from "./fields/EinField";
import { RadioGroupField } from "./fields/RadioGroupField";
import { SignatureField } from "./fields/SignatureField";
import { SsnField } from "./fields/SsnField";
import { TextField } from "./fields/TextField";
import { fieldIsVisible } from "./visibility";

type FormSidebarProps = {
  sections: FormSection[];
};

/**
 * Right-hand sidebar — labelled inputs grouped by W-9 section.
 *
 * Both the overlay and the sidebar dispatch to the same per-type field
 * components, so the two stay in lockstep: typing on either side updates
 * the shared Zustand store and re-renders the other.
 */
export function FormSidebar({ sections }: FormSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col gap-5 overflow-y-auto border-l border-default-200 bg-[var(--color-background)] p-4 dark:border-default-700">
      {sections.map((section) => (
        <section
          key={section.id}
          className="flex flex-col gap-3 rounded-2xl border border-default-200 bg-[var(--color-background)] p-4 shadow-sm dark:border-default-700"
        >
          <header>
            <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
              {section.title}
            </h2>
            {section.description ? (
              <p className="mt-1 text-xs text-default-500">
                {section.description}
              </p>
            ) : null}
          </header>
          <div className="flex flex-col gap-3">
            {section.fields.map((field) => (
              <SidebarFieldDispatcher key={field.id} field={field} />
            ))}
          </div>
        </section>
      ))}
    </aside>
  );
}

function SidebarFieldDispatcher({ field }: { field: FormField }) {
  const values = useFormEditorStore((s) => s.values);

  if (!fieldIsVisible(field, values)) return null;

  const props = { field, mode: "sidebar" as const };

  switch (field.type) {
    case "text":
      return <TextField {...props} />;
    case "ssn":
      return <SsnField {...props} />;
    case "ein":
      return <EinField {...props} />;
    case "date":
      return <DateField {...props} />;
    case "radio":
      return <RadioGroupField {...props} />;
    case "checkbox":
      return <CheckboxField {...props} />;
    case "signature":
      return <SignatureField {...props} />;
    default:
      return null;
  }
}

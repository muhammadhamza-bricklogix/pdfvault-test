import type {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFForm,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";

export type FormFieldDescriptor =
  | {
      kind: "checkbox";
      name: string;
      value: boolean;
    }
  | {
      kind: "dropdown";
      name: string;
      options: string[];
      value: string;
    }
  | {
      kind: "optionList";
      name: string;
      options: string[];
      value: string;
    }
  | {
      kind: "radio";
      name: string;
      options: string[];
      value: string;
    }
  | {
      kind: "text";
      name: string;
      value: string;
    };

export type FormFieldValue = {
  name: string;
  value: boolean | string;
};

function isTextField(field: unknown): field is PDFTextField {
  return (
    (field as { constructor: { name: string } }).constructor.name ===
    "PDFTextField"
  );
}

function isCheckBox(field: unknown): field is PDFCheckBox {
  return (
    (field as { constructor: { name: string } }).constructor.name ===
    "PDFCheckBox"
  );
}

function isRadioGroup(field: unknown): field is PDFRadioGroup {
  return (
    (field as { constructor: { name: string } }).constructor.name ===
    "PDFRadioGroup"
  );
}

function isDropdown(field: unknown): field is PDFDropdown {
  return (
    (field as { constructor: { name: string } }).constructor.name ===
    "PDFDropdown"
  );
}

function isOptionList(field: unknown): field is PDFOptionList {
  return (
    (field as { constructor: { name: string } }).constructor.name ===
    "PDFOptionList"
  );
}

/**
 * Reads every AcroForm field on the document. Returns an empty array if
 * the PDF has no form. Callers are expected to render UI from this list
 * and call `applyFormFieldValues` with the user's input.
 */
export function listFormFields(pdfDoc: PDFDocument): FormFieldDescriptor[] {
  let form: PDFForm;

  try {
    form = pdfDoc.getForm();
  } catch {
    return [];
  }

  const fields = form.getFields();
  const out: FormFieldDescriptor[] = [];

  for (const field of fields) {
    const name = field.getName();

    if (isTextField(field)) {
      out.push({ kind: "text", name, value: field.getText() ?? "" });
    } else if (isCheckBox(field)) {
      out.push({ kind: "checkbox", name, value: field.isChecked() });
    } else if (isRadioGroup(field)) {
      out.push({
        kind: "radio",
        name,
        options: field.getOptions(),
        value: field.getSelected() ?? "",
      });
    } else if (isDropdown(field)) {
      out.push({
        kind: "dropdown",
        name,
        options: field.getOptions(),
        value: field.getSelected()[0] ?? "",
      });
    } else if (isOptionList(field)) {
      out.push({
        kind: "optionList",
        name,
        options: field.getOptions(),
        value: field.getSelected()[0] ?? "",
      });
    }
  }

  return out;
}

/**
 * Writes the supplied values back onto the document's AcroForm. If
 * `flatten` is true, bakes the values into page content so downstream
 * viewers can no longer edit them. Mutates `pdfDoc` in place.
 */
export function applyFormFieldValues(
  pdfDoc: PDFDocument,
  values: FormFieldValue[],
  flatten = false,
): void {
  let form: PDFForm;

  try {
    form = pdfDoc.getForm();
  } catch {
    return;
  }

  for (const { name, value } of values) {
    const field = form.getFieldMaybe(name);

    if (!field) continue;

    try {
      if (isTextField(field) && typeof value === "string") {
        field.setText(value);
      } else if (isCheckBox(field)) {
        if (value === true) field.check();
        else field.uncheck();
      } else if (isRadioGroup(field) && typeof value === "string" && value) {
        field.select(value);
      } else if (isDropdown(field) && typeof value === "string") {
        if (value) field.select(value);
        else field.clear();
      } else if (isOptionList(field) && typeof value === "string") {
        if (value) field.select(value);
        else field.clear();
      }
    } catch {
      // Pdf-lib throws on certain unsupported encodings (e.g. non-ASCII into a
      // standard-font text field). Skip the bad field rather than abort the
      // whole save — the user can still keep the rest of their values.
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch {
      // Ignore — fall back to keeping the form interactive.
    }
  }
}

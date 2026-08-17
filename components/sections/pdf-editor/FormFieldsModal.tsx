"use client";

import type { FormFieldDescriptor } from "@/lib/client/pdf-editor/form-fields";

import { Button, Label, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import { listFormFields } from "@/lib/client/pdf-editor/form-fields";
import { usePdfEditorStore } from "@/lib/client/stores";
import { logger } from "@/lib/shared/utils/logger";

type FieldState = Record<string, boolean | string>;

function initialState(fields: FormFieldDescriptor[]): FieldState {
  const out: FieldState = {};

  for (const f of fields) out[f.name] = f.value;

  return out;
}

export function FormFieldsModal() {
  const isOpen = usePdfEditorStore((s) => s.isFormFieldsModalOpen);
  const setIsOpen = usePdfEditorStore((s) => s.setIsFormFieldsModalOpen);
  const file = usePdfEditorStore((s) => s.file);

  const [fields, setFields] = useState<FormFieldDescriptor[]>([]);
  const [values, setValues] = useState<FieldState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !file) return;

    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const bytes = await file.arrayBuffer();
        const { PDFDocument } = await import("pdf-lib");
        const pdfDoc = await PDFDocument.load(bytes, {
          ignoreEncryption: true,
        });
        const detected = listFormFields(pdfDoc);

        if (cancelled) return;

        setFields(detected);
        setValues(initialState(detected));
      } catch (err) {
        logger.error("Failed to read form fields", err);
        if (!cancelled) setError("Couldn't read form fields from this PDF.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [file, isOpen]);

  const handleClose = () => setIsOpen(false);

  const submit = (flatten: boolean) => {
    window.dispatchEvent(
      new CustomEvent("editor:apply-form-fields", {
        detail: {
          flatten,
          values: fields.map((f) => ({
            name: f.name,
            value: values[f.name] ?? (f.kind === "checkbox" ? false : ""),
          })),
        },
      }),
    );
    handleClose();
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="!w-[92vw] !max-w-[600px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Fill form fields</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="space-y-4">
            {isLoading && (
              <p className="text-sm text-default-500">Reading form fields…</p>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            {!isLoading && !error && fields.length === 0 && (
              <div className="rounded-lg border border-default-200 bg-default-50 p-4 text-sm">
                <p className="font-medium">No form fields detected.</p>
                <p className="mt-1 text-xs text-default-500">
                  This PDF doesn&apos;t contain an AcroForm. Use the Text tool
                  to add free-form text annotations instead.
                </p>
              </div>
            )}

            {!isLoading && fields.length > 0 && (
              <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                {fields.map((f) => {
                  const currentValue = values[f.name];

                  if (f.kind === "text") {
                    return (
                      <div key={f.name}>
                        <Label className="mb-1 block text-xs text-default-500">
                          {f.name}
                        </Label>
                        <input
                          className="w-full rounded-md border border-default-200 px-3 py-2 text-sm"
                          type="text"
                          value={
                            typeof currentValue === "string" ? currentValue : ""
                          }
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [f.name]: e.target.value,
                            }))
                          }
                        />
                      </div>
                    );
                  }

                  if (f.kind === "checkbox") {
                    return (
                      <label
                        key={f.name}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          checked={currentValue === true}
                          type="checkbox"
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [f.name]: e.target.checked,
                            }))
                          }
                        />
                        <span>{f.name}</span>
                      </label>
                    );
                  }

                  if (
                    f.kind === "dropdown" ||
                    f.kind === "optionList" ||
                    f.kind === "radio"
                  ) {
                    return (
                      <div key={f.name}>
                        <Label className="mb-1 block text-xs text-default-500">
                          {f.name}
                        </Label>
                        <select
                          className="w-full rounded-md border border-default-200 bg-[var(--color-background)] px-3 py-2 text-sm"
                          value={
                            typeof currentValue === "string" ? currentValue : ""
                          }
                          onChange={(e) =>
                            setValues((v) => ({
                              ...v,
                              [f.name]: e.target.value,
                            }))
                          }
                        >
                          <option value="">— Select —</option>
                          {f.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button
              isDisabled={!file || fields.length === 0}
              variant="tertiary"
              onPress={() => submit(false)}
            >
              Save values
            </Button>
            <Button
              isDisabled={!file || fields.length === 0}
              onPress={() => submit(true)}
            >
              Save &amp; flatten
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

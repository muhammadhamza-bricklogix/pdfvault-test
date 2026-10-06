"use client";

import { Button, Input, Label, Modal, TextField } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type DuplicateOutcome,
  type DuplicatePromptRequest,
  setDuplicatePromptHandler,
} from "@/lib/client/hooks/documents/duplicate-prompt-bus";
import { findDuplicateByFilename } from "@/lib/client/hooks/upload/use-upload-with-duplicate-check";
import { validateRenameFilename } from "@/lib/shared/schemas/documents/rename.schema";

/**
 * Global "file already exists" modal. Registers itself with the
 * duplicate-prompt bus at mount so any save/auto-persist call in the
 * app can await a user decision. Only one instance is expected — mount
 * inside `AppProviders` alongside PaywallModal / AuthModal.
 *
 * Three outcomes:
 *
 *   - **Replace**  → save into the existing document (backend versions
 *     it), then continue the queued action.
 *   - **Rename**   → save under a new name, creating a second row. The
 *     input starts on the first free "name (n)" the caller found.
 *   - **Cancel**   → skip the cloud save, keep editing locally, no
 *     error toast.
 */
type Mode = "replace" | "rename";

export function DuplicateFilenameModal() {
  const [request, setRequest] = useState<DuplicatePromptRequest | null>(null);
  const [mode, setMode] = useState<Mode>("replace");
  const [name, setName] = useState("");
  const [takenError, setTakenError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const resolveRef = useRef<((outcome: DuplicateOutcome) => void) | null>(null);

  useEffect(() => {
    setDuplicatePromptHandler((req) => {
      return new Promise<DuplicateOutcome>((resolve) => {
        resolveRef.current = resolve;
        setMode("replace");
        setName(req.suggestion ?? req.filename);
        setTakenError(null);
        setChecking(false);
        setRequest(req);
      });
    });

    return () => setDuplicatePromptHandler(null);
  }, []);

  const resolve = useCallback((outcome: DuplicateOutcome) => {
    const fn = resolveRef.current;

    resolveRef.current = null;
    setRequest(null);
    fn?.(outcome);
  }, []);

  const isOpen = request !== null;
  const filename = request?.filename ?? "";
  const trimmed = name.trim();
  const formatError = trimmed ? validateRenameFilename(trimmed) : null;
  const blocked =
    mode === "rename" && (!trimmed || !!formatError || !!takenError);

  const confirm = useCallback(async () => {
    if (mode === "replace") {
      resolve({ kind: "overwrite" });

      return;
    }
    if (!trimmed || formatError) return;

    // Re-check at confirm time: the suggestion was computed before the
    // user edited it, and they may have typed a name that is also taken.
    setChecking(true);
    try {
      const clash = await findDuplicateByFilename(trimmed);

      if (clash) {
        setTakenError("A file with this name already exists.");

        return;
      }
    } catch {
      // A flaky list call must not strand the user — let the save proceed
      // and let the server be the source of truth.
    } finally {
      setChecking(false);
    }

    resolve({ kind: "rename", filename: trimmed });
  }, [mode, trimmed, formatError, resolve]);

  return (
    <Modal.Backdrop
      isDismissable={false}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && isOpen) resolve({ kind: "cancel" });
      }}
    >
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog className="!w-[min(440px,calc(100vw-32px))] overflow-visible rounded-2xl bg-white p-0 shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] dark:bg-content1">
          <div className="px-6 pb-6 pt-7">
            <h2 className="text-center text-xl font-bold text-[var(--color-foreground)]">
              File already exists
            </h2>
            <p className="mt-3 text-center text-sm text-default-500">
              A file named{" "}
              <span className="break-all font-semibold text-default-700">
                {filename}
              </span>{" "}
              is already in your library.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              <ModeChoice
                description="Keeps one file. The previous version stays in history."
                isSelected={mode === "replace"}
                label="Replace it"
                onSelect={() => setMode("replace")}
              />
              <ModeChoice
                description="Keeps both. This one is saved under a new name."
                isSelected={mode === "rename"}
                label="Save as a new file"
                onSelect={() => setMode("rename")}
              />
            </div>

            {mode === "rename" ? (
              <TextField
                className="mt-4"
                isInvalid={!!formatError || !!takenError}
                value={name}
                onChange={(next) => {
                  setName(next);
                  setTakenError(null);
                }}
              >
                <Label className="text-xs font-medium text-default-600">
                  New name
                </Label>
                <Input autoFocus />
                {formatError || takenError ? (
                  <p className="mt-1 text-xs text-danger">
                    {formatError ?? takenError}
                  </p>
                ) : null}
              </TextField>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                className="flex-1"
                variant="secondary"
                onPress={() => resolve({ kind: "cancel" })}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                isDisabled={blocked || checking}
                variant="primary"
                onPress={() => void confirm()}
              >
                {checking
                  ? "Checking…"
                  : mode === "replace"
                    ? "Replace"
                    : "Save"}
              </Button>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

function ModeChoice({
  description,
  isSelected,
  label,
  onSelect,
}: {
  description: string;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={`rounded-xl border px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-[var(--color-accent)] bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)]"
          : "border-default-200 hover:bg-default-100"
      }`}
      type="button"
      onClick={onSelect}
    >
      <span className="block text-sm font-semibold text-[var(--color-foreground)]">
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-default-500">
        {description}
      </span>
    </button>
  );
}

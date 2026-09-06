"use client";

import { Button, Modal } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  type DuplicateOutcome,
  type DuplicatePromptRequest,
  setDuplicatePromptHandler,
} from "@/lib/client/hooks/documents/duplicate-prompt-bus";

/**
 * Global "file already exists" modal. Registers itself with the
 * duplicate-prompt bus at mount so any save/auto-persist call in the
 * app can await a user decision. Only one instance is expected — mount
 * inside `AppProviders` alongside PaywallModal / AuthModal.
 *
 * QA 2026-09-06: after signing in, if the user's uploaded file has the
 * same name as an existing doc in their Vault, the save must not fail
 * silently and must not blindly create a duplicate row. Instead show
 * an explicit choice:
 *
 *   - **Overwrite** → save into the existing document (backend
 *     versions it), then continue the queued action.
 *   - **Cancel**    → skip the cloud save, keep editing locally, no
 *     error toast.
 */
export function DuplicateFilenameModal() {
  const [request, setRequest] = useState<DuplicatePromptRequest | null>(null);
  const resolveRef = useRef<((outcome: DuplicateOutcome) => void) | null>(null);

  useEffect(() => {
    setDuplicatePromptHandler((req) => {
      return new Promise<DuplicateOutcome>((resolve) => {
        resolveRef.current = resolve;
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

  return (
    <Modal.Backdrop
      isDismissable={false}
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && isOpen) resolve("cancel");
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
              already exists in your library. Overwrite it, or cancel to keep
              editing locally.
            </p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <Button
                className="flex-1"
                variant="secondary"
                onPress={() => resolve("cancel")}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                variant="primary"
                onPress={() => resolve("overwrite")}
              >
                Overwrite
              </Button>
            </div>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

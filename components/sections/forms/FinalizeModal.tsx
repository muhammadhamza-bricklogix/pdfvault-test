"use client";

import { Button, Modal } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useFinalizeFormSessionMutation } from "@/lib/client/query/mutations/forms.mutation";
import { useFormEditorStore } from "@/lib/client/stores";
import { ROUTES } from "@/lib/shared/constants/routes";
import { toast } from "@/lib/shared/utils/toast";

type FinalizeModalProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FinalizeModal({ isOpen, onOpenChange }: FinalizeModalProps) {
  const router = useRouter();
  const sessionId = useFormEditorStore((s) => s.sessionId);
  const finalizedUrl = useFormEditorStore((s) => s.finalizedUrl);
  const setFinalizedUrl = useFormEditorStore((s) => s.setFinalizedUrl);
  const reset = useFormEditorStore((s) => s.reset);

  const finalize = useFinalizeFormSessionMutation();
  const [phase, setPhase] = useState<"generating" | "ready" | "idle">("idle");

  // Kick off the finalize call the first time the modal opens after a clean
  // validation pass. The owner of this modal (FormFooter) is responsible for
  // pre-flighting validation before opening.
  const handleGenerate = async () => {
    if (!sessionId) return;
    setPhase("generating");

    // The backend no longer holds intermediate values — hand it everything
    // in this single finalize call.
    const { values, signatureKey } = useFormEditorStore.getState();

    try {
      const { downloadUrl } = await finalize.mutateAsync({
        sessionId,
        values,
        signatureKey,
      });

      setFinalizedUrl(downloadUrl);
      setPhase("ready");
    } catch (err) {
      setPhase("idle");
      toast.error({
        title: "Couldn't generate the PDF",
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleFillAnother = () => {
    onOpenChange(false);
    reset();
    router.push(ROUTES.FORMS.W9_EDIT);
  };

  const handlePrint = () => {
    if (!finalizedUrl) return;
    const printWindow = window.open(finalizedUrl, "_blank");

    if (!printWindow) {
      toast.error({ title: "Pop-up blocked — allow pop-ups to print." });

      return;
    }
    printWindow.addEventListener("load", () => printWindow.print());
  };

  // Initial render shows a "Generate" button; subsequent renders may already
  // have a finalizedUrl from a previous run.
  const isGenerating = phase === "generating";
  const isReady = phase === "ready" && Boolean(finalizedUrl);

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>
              {isReady ? "Your W-9 is ready" : "Generate your W-9"}
            </Modal.Heading>
          </Modal.Header>

          <Modal.Body className="p-5">
            {isGenerating ? (
              <p className="text-sm text-default-600">Generating your PDF…</p>
            ) : isReady ? (
              <p className="text-sm text-default-600">
                Download, print, or start another. Your data stays in this
                session.
              </p>
            ) : (
              <p className="text-sm text-default-600">
                We&apos;ll stamp every value onto the IRS template and hand you
                a clean PDF — no further edits required.
              </p>
            )}
          </Modal.Body>

          <Modal.Footer className="flex flex-wrap gap-2">
            {isReady ? (
              <>
                <Button variant="tertiary" onPress={handleFillAnother}>
                  Fill another form
                </Button>
                <Button variant="secondary" onPress={handlePrint}>
                  Print
                </Button>
                <a
                  download
                  className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
                  href={finalizedUrl ?? "#"}
                >
                  Download PDF
                </a>
              </>
            ) : (
              <>
                <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  isDisabled={isGenerating}
                  variant="primary"
                  onPress={handleGenerate}
                >
                  {isGenerating ? "Generating…" : "Generate PDF"}
                </Button>
              </>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

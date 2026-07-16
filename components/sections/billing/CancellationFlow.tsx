"use client";

import type { ChurnReason } from "@/lib/client/query/mutations/cancellation.mutation";

import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import { useFinalizeCancellationMutation } from "@/lib/client/query/mutations/cancellation.mutation";
import { toast } from "@/lib/shared/utils/toast";

interface CancellationFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Two-step cancellation modal.
 *
 *   Step 1 — churn-reason capture (categorical + free-text)
 *   Step 2 — final confirmation → cancel-at-period-end
 *
 * The 1Y / 2Y downsell tiers were dropped from the product spec — user
 * goes straight from feedback to finalisation. Feedback is still
 * mapped to a Solidgate cancel_code on the backend so retention
 * analytics stay unchanged.
 */
export function CancellationFlow({ isOpen, onClose }: CancellationFlowProps) {
  const [step, setStep] = useState<"feedback" | "confirmed">("feedback");
  const [reason, setReason] = useState<ChurnReason>("unforeseen_circumstances");
  const [freeText, setFreeText] = useState("");

  const finalize = useFinalizeCancellationMutation();

  useEffect(() => {
    if (!isOpen) return;

    return () => {
      // Reset on close so a re-open starts fresh, not on the confirmed
      // screen from the last dismissal.
      setStep("feedback");
      setReason("unforeseen_circumstances");
      setFreeText("");
    };
  }, [isOpen]);

  const handleFinalize = () => {
    finalize.mutate(
      { reason, freeText: freeText || undefined },
      {
        onSuccess: () => setStep("confirmed"),
        onError: () =>
          toast.error({
            title: "Couldn't cancel your subscription",
            description: "Please try again or email payments@pdfvault.ai.",
          }),
      },
    );
  };

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[540px]">
          <Modal.CloseTrigger />
          {step === "feedback" && (
            <FeedbackStep
              finalising={finalize.isPending}
              freeText={freeText}
              reason={reason}
              onCancel={handleFinalize}
              onFreeTextChange={setFreeText}
              onReasonChange={setReason}
            />
          )}
          {step === "confirmed" && <ConfirmedStep onClose={onClose} />}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

const REASON_OPTIONS: { value: ChurnReason; label: string }[] = [
  { value: "unforeseen_circumstances", label: "Unforeseen circumstances" },
  { value: "lacks_features_i_need", label: "Lacks features I need" },
  { value: "too_expensive", label: "Too expensive" },
  { value: "only_needed_it_once", label: "I only needed it once" },
  { value: "too_buggy", label: "Too buggy" },
  {
    value: "switching_to_a_different_tool",
    label: "Switching to a different tool",
  },
  { value: "other", label: "Other" },
];

function FeedbackStep({
  reason,
  onReasonChange,
  freeText,
  onFreeTextChange,
  onCancel,
  finalising,
}: {
  reason: ChurnReason;
  onReasonChange: (r: ChurnReason) => void;
  freeText: string;
  onFreeTextChange: (t: string) => void;
  onCancel: () => void;
  finalising: boolean;
}) {
  return (
    <>
      <Modal.Header>
        <Modal.Heading>Before you go</Modal.Heading>
        <p className="mt-1 text-xs text-default-500">
          Tell us what didn&apos;t work. It only takes a moment.
        </p>
      </Modal.Header>
      <Modal.Body>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            What&apos;s the main reason?
          </legend>
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-sm hover:bg-default-50"
            >
              <input
                checked={reason === opt.value}
                className="accent-[var(--pv-brand-red)]"
                name="churn-reason"
                type="radio"
                value={opt.value}
                onChange={() => onReasonChange(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </fieldset>
        <textarea
          className="mt-3 min-h-[80px] w-full rounded-lg border border-default-200 bg-default-50 p-2 text-sm outline-none focus:border-default-400"
          maxLength={2000}
          placeholder="What would make you use PDFVault regularly? (optional)"
          value={freeText}
          onChange={(e) => onFreeTextChange(e.target.value)}
        />
      </Modal.Body>
      <Modal.Footer>
        <Button isDisabled={finalising} variant="primary" onPress={onCancel}>
          {finalising ? "Cancelling…" : "Cancel my subscription"}
        </Button>
      </Modal.Footer>
    </>
  );
}

function ConfirmedStep({ onClose }: { onClose: () => void }) {
  return (
    <>
      <Modal.Header>
        <Modal.Heading>You&apos;re all set</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-default-600">
          Your subscription has been cancelled. You&apos;ll continue to have
          access until the end of your current billing period. You can renew
          anytime from your billing settings.
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onPress={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </>
  );
}

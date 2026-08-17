"use client";

import type { ChurnReason } from "@/lib/client/query/mutations/cancellation.mutation";

import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import { useFinalizeCancellationMutation } from "@/lib/client/query/mutations/cancellation.mutation";
import { toast } from "@/lib/shared/utils/toast";

const RETENTION_DAYS = 30;

interface CancellationFlowProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Fired once the local cancellation call succeeds. Callers can use
   * this to flip a UI-side "just cancelled" flag so the Refresh button
   * in the billing settings doesn't immediately re-sync against
   * Solidgate and resurrect the row while replication is still in
   * flight.
   */
  onCancelled?: () => void;
}

/**
 * Two-step cancellation modal, restyled to match the app's --pv-* tokens
 * so it sits naturally alongside the settings / billing surfaces.
 *
 *   Step 1 — churn-reason capture (categorical + free-text)
 *   Step 2 — final confirmation → cancel-at-period-end, with the
 *            retention message ("your files stay for {RETENTION_DAYS}
 *            days") that mirrors the PaywallModal's trust block.
 *
 * The 1Y / 2Y downsell tiers were dropped from the product spec — user
 * goes straight from feedback to finalisation. Feedback is still
 * mapped to a processor cancel_code on the backend so retention
 * analytics stay unchanged.
 */
export function CancellationFlow({
  isOpen,
  onClose,
  onCancelled,
}: CancellationFlowProps) {
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
        onSuccess: () => {
          setStep("confirmed");
          onCancelled?.();
        },
        onError: () =>
          toast.error({
            title: "Couldn't cancel your subscription",
            description: "Please try again or email support@pdfvault.ai.",
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
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog className="w-full overflow-hidden rounded-2xl border border-[var(--pv-hairline)] bg-white dark:bg-content1 shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:max-w-[540px]">
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
        <Modal.Heading className="pv-heading text-[var(--pv-text-strong)]">
          Before you go
        </Modal.Heading>
        <p className="mt-1 text-[13px] text-[var(--pv-text-muted)]">
          Tell us what didn&apos;t work. It only takes a moment.
        </p>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-4 rounded-xl border border-[var(--pv-hairline)] bg-[#f7f7f7] dark:bg-content2 p-3.5">
          <p className="text-[12px] font-semibold text-[var(--pv-text-strong)]">
            Your files stay safe
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-body)]">
            After cancellation your PDFs stay in your account for{" "}
            <span className="font-semibold text-[var(--pv-text-strong)]">
              {RETENTION_DAYS} days
            </span>{" "}
            so you can download them or resubscribe without losing work.
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-2 text-[13px] font-medium text-[var(--pv-text-strong)]">
            What&apos;s the main reason?
          </legend>
          {REASON_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 text-[13px] text-[var(--pv-text-body)] hover:bg-[#f7f7f7] dark:bg-content2"
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
          className="mt-3 min-h-[80px] w-full rounded-lg border border-[var(--pv-hairline)] bg-[#f7f7f7] dark:bg-content2 p-3 text-[13px] text-[var(--pv-text-body)] outline-none placeholder:text-[var(--pv-text-muted)] focus:border-[var(--pv-hairline-strong)]"
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
        <Modal.Heading className="pv-heading text-[var(--pv-text-strong)]">
          You&apos;re all set
        </Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-[13px] leading-relaxed text-[var(--pv-text-body)]">
          Your subscription has been cancelled. You&apos;ll continue to have
          full access until the end of your current billing period.
        </p>
        <div className="mt-3 rounded-xl border border-[var(--pv-hairline)] bg-[#f7f7f7] dark:bg-content2 p-3.5">
          <p className="text-[12px] font-semibold text-[var(--pv-text-strong)]">
            Your files stay for {RETENTION_DAYS} more days
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--pv-text-body)]">
            After that we clear them from our servers. Renew anytime from
            Settings → Billing to keep everything.
          </p>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onPress={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </>
  );
}

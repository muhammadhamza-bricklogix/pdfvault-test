"use client";

import type { ChurnReason } from "@/lib/client/query/mutations/cancellation.mutation";

import { Button, Modal } from "@heroui/react";
import { useEffect, useState } from "react";

import {
  useAcceptDownsellMutation,
  useFinalizeCancellationMutation,
  useRecordOfferShownMutation,
} from "@/lib/client/query/mutations/cancellation.mutation";
import { toast } from "@/lib/shared/utils/toast";

interface CancellationFlowProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Three-step cancellation modal.
 *
 *   Step 1 — churn-reason capture (categorical + free-text)
 *   Step 2 — Tier-1 downsell ("1 year full access at ~90% off")
 *   Step 3 — Tier-2 downsell ("2 years at the same discounted rate")
 *   Step 4 — final confirmation → cancel-at-period-end
 *
 * Skipping to the next tier records the previous offer as "shown but
 * rejected" via `/billing/cancellation/offer-shown`. Accepting either
 * tier swaps the product and closes. Rejecting both fires the final
 * cancellation with the captured feedback → Solidgate cancel_code.
 */
export function CancellationFlow({ isOpen, onClose }: CancellationFlowProps) {
  const [step, setStep] = useState<
    "feedback" | "tier-1" | "tier-2" | "confirmed"
  >("feedback");
  const [reason, setReason] = useState<ChurnReason>("unforeseen_circumstances");
  const [freeText, setFreeText] = useState("");

  const recordShown = useRecordOfferShownMutation();
  const acceptDownsell = useAcceptDownsellMutation();
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

  const advanceFromFeedback = () => {
    recordShown.mutate({ tier: 1 });
    setStep("tier-1");
  };

  const advanceToTier2 = () => {
    recordShown.mutate({ tier: 2 });
    setStep("tier-2");
  };

  const handleAccept = (tier: 1 | 2) => {
    acceptDownsell.mutate(
      { tier },
      {
        onSuccess: () => {
          toast.success({
            title: "Discount applied",
            description: "Your plan has been switched.",
          });
          setStep("confirmed");
        },
        onError: () =>
          toast.error({
            title: "Couldn't apply the discount",
            description: "Please try again or contact support.",
          }),
      },
    );
  };

  const handleFinalize = () => {
    finalize.mutate(
      { reason, freeText: freeText || undefined, rejectedThroughTier: 2 },
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
              freeText={freeText}
              reason={reason}
              onFreeTextChange={setFreeText}
              onNext={advanceFromFeedback}
              onReasonChange={setReason}
            />
          )}
          {step === "tier-1" && (
            <TierStep
              accepting={acceptDownsell.isPending}
              rejectLabel="No thanks, continue cancelling"
              tier={1}
              onAccept={() => handleAccept(1)}
              onReject={advanceToTier2}
            />
          )}
          {step === "tier-2" && (
            <TierStep
              accepting={acceptDownsell.isPending}
              rejectLabel={
                finalize.isPending ? "Cancelling…" : "No thanks, cancel my plan"
              }
              tier={2}
              onAccept={() => handleAccept(2)}
              onReject={handleFinalize}
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
  onNext,
}: {
  reason: ChurnReason;
  onReasonChange: (r: ChurnReason) => void;
  freeText: string;
  onFreeTextChange: (t: string) => void;
  onNext: () => void;
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
        <Button variant="primary" onPress={onNext}>
          Continue
        </Button>
      </Modal.Footer>
    </>
  );
}

function TierStep({
  tier,
  onAccept,
  onReject,
  accepting,
  rejectLabel,
}: {
  tier: 1 | 2;
  onAccept: () => void;
  onReject: () => void;
  accepting: boolean;
  rejectLabel: string;
}) {
  const heading =
    tier === 1
      ? "Wait — take 90% off a full year"
      : "Lock the same discount for 2 years";
  const body =
    tier === 1
      ? "One payment. One-year access to every PDFVault feature at the deepest discount we offer."
      : "Same discounted rate, twice the runway. Perfect if you know you'll come back to it.";

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{heading}</Modal.Heading>
      </Modal.Header>
      <Modal.Body>
        <p className="text-sm text-default-600">{body}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button isDisabled={accepting} variant="secondary" onPress={onReject}>
          {rejectLabel}
        </Button>
        <Button isDisabled={accepting} variant="primary" onPress={onAccept}>
          {accepting ? "Applying…" : "Accept offer"}
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
          The change will reflect in your billing dashboard within a minute. You
          can always come back and change your plan later.
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

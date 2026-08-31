"use client";

import { useSignIn } from "@clerk/nextjs";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Modal } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import { dispatchLoginToDownloadModal } from "@/components/shared/login-to-download-modal";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";
import { toast } from "@/lib/shared/utils/toast";

export type EmailFirstModalDetail = {
  /**
   * Where to send the user after the auth flow completes. Handed
   * straight through to the downstream AuthModal (which passes it to
   * LoginCard/SignupCard as `redirectUrl`). Cards finalize with
   * `window.location.assign(redirectUrl)` per CLAUDE.md item #15.
   */
  redirectUrl?: string;
  /** Optional title override — defaults to "Welcome back". */
  title?: string;
  /**
   * Optional subtitle rendered under the heading. Defaults to no
   * subtitle. The editor Done → Download flow passes "Create an
   * account to download it" so the modal explains WHY we need the
   * email up front.
   */
  subtitle?: string;
  /**
   * Optional CTA label override — defaults to "Log in with email".
   * The editor Done → Download flow passes "Download file" so the
   * button copy matches the user's intent (they clicked Download,
   * not Log In). Auth chain downstream is unchanged.
   */
  submitLabel?: string;
  /**
   * Optional email prefill. Used by the LoginToDownloadModal's Back
   * button so the user's email is restored when they return.
   */
  initialEmail?: string;
};

/**
 * Fire from anywhere to open the email-first modal. Mirrors
 * `dispatchAuthModal` so callers don't need to plumb open-state
 * through context.
 */
export function dispatchEmailFirstModal(detail: EmailFirstModalDetail = {}) {
  if (typeof window === "undefined") return;
  logger.event(EVENTS.SIGNIN_PROMPT_DISPATCHED, "info", {
    destination: "email-first",
    hasRedirect: Boolean(detail.redirectUrl),
  });
  window.dispatchEvent(new CustomEvent("app:email-first-modal", { detail }));
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-first modal (2026-08-30 PM ask):
 *
 *   1. Signed-out user clicks Done / Download in the editor
 *   2. This modal opens with just an email input + "Log in with email"
 *   3. User submits — we probe Clerk with `signIn.create({ identifier })`
 *   4. If Clerk returns success / needs_first_factor → account EXISTS
 *      → close this modal + dispatch AuthModal(mode=login) with the
 *      email pre-filled, so the user just enters password
 *   5. If Clerk returns `form_identifier_not_found` → account is NEW
 *      → close this + dispatch AuthModal(mode=signup) with email
 *      pre-filled, so the user picks a password and continues
 *
 * The full Scenario 2 "background create + guest paywall" flow is
 * NOT implemented here — it needs a backend endpoint that accepts
 * guest checkout via Solidgate + a webhook that creates the Clerk
 * user post-payment. This modal is the graceful-degradation path:
 * new users still land in the signup card and go through the normal
 * signup → verify → paywall chain.
 */
export function EmailFirstModal() {
  const { signIn } = useSignIn();
  const [detail, setDetail] = useState<EmailFirstModalDetail | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<EmailFirstModalDetail>;
      const nextDetail = custom.detail ?? {};

      setDetail(nextDetail);
      setEmail(nextDetail.initialEmail ?? "");
      setError(null);
      setSubmitting(false);
    };

    window.addEventListener("app:email-first-modal", onOpen);

    return () => window.removeEventListener("app:email-first-modal", onOpen);
  }, []);

  const close = useCallback(() => {
    setDetail(null);
    setSubmitting(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn || submitting) return;

    const trimmed = email.trim();

    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address.");

      return;
    }

    setError(null);
    setSubmitting(true);

    // "Just a moment…" toast (top banner via HeroUI toast provider)
    // gives the user feedback that the check is in flight while the
    // button reads "Checking…". Fires immediately so it's visible
    // during the probe; the toast's own 5s default timeout usually
    // outlives the probe (typically < 1s).
    const checkingToastKey = toast.info({
      title: "Just a moment…",
      description: "Checking your email.",
    });

    try {
      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] email_first.probe", { hasEmail: true });
      const { error: probeError } = await signIn.create({
        identifier: trimmed,
      });

      // Existing account: `signIn.create` returns no error and the
      // signIn moves to needs_first_factor (or complete for OAuth-
      // only accounts). Hand off to LoginToDownloadModal, which
      // renders Google + email options and preserves a Back path
      // to this modal.
      if (!probeError) {
        // eslint-disable-next-line no-console
        console.info("[AUTH_DIAG] email_first.exists", {
          signInStatus: signIn.status,
        });
        // Abandon the probe sign-in so LoginCard starts fresh — a
        // half-created signIn resource in the client state confuses
        // the card's own `signIn.password({...})` call.
        try {
          await signIn.reset();
        } catch {
          // Best-effort; reset failures don't block the handoff.
        }

        const previousDetail = detail;

        dispatchLoginToDownloadModal({
          email: trimmed,
          redirectUrl: detail?.redirectUrl,
          // Preserve the caller's title/subtitle/submitLabel so the
          // Back button restores the same modal presentation.
          emailFirstDetail: previousDetail
            ? {
                ...previousDetail,
                initialEmail: trimmed,
              }
            : undefined,
        });
        // Unmount this modal on the same tick so the two modals
        // don't visually overlap.
        close();

        return;
      }

      const code = (probeError as { errors?: { code?: string }[] })?.errors?.[0]
        ?.code;

      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] email_first.probe_error", {
        code,
        signInStatus: signIn.status,
      });

      // New account — Clerk explicitly says "no user for this identifier".
      // Route to Signup with the email pre-filled.
      if (code === "form_identifier_not_found") {
        dispatchAuthModal({
          mode: "signup",
          redirectUrl: detail?.redirectUrl,
          email: trimmed,
        });
        close();

        return;
      }

      // Any other error from the probe (e.g. rate limit, network) —
      // fall through to signup on the assumption that a new account
      // is more likely than an existing one at this modal (the whole
      // point of this flow is capturing conversions). User can still
      // switch to Login via the in-card link if we guessed wrong.
      logger.warn("email_first.probe: unexpected code — routing to signup", {
        code,
      });
      dispatchAuthModal({
        mode: "signup",
        redirectUrl: detail?.redirectUrl,
        email: trimmed,
      });
      close();
    } catch (err) {
      logger.captureError(err, "email_first.probe_threw");
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
      // Dismiss the "Just a moment…" toast whichever branch we took
      // — success dispatch, new-account dispatch, or thrown error.
      if (checkingToastKey) toast.close(checkingToastKey);
    }
  };

  const isOpen = detail !== null;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Container className="min-h-full items-center justify-center overflow-y-auto overscroll-contain p-4">
        <Modal.Dialog className="!w-fit !max-w-[min(500px,calc(100vw-32px))] overflow-visible bg-transparent p-0 shadow-none">
          <div className="relative">
            <button
              aria-label="Close"
              className="absolute right-4 top-4 z-10 inline-flex size-8 items-center justify-center rounded-md text-[#8a8a8a] transition-colors hover:bg-default-100 hover:text-[#1a1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              type="button"
              onClick={close}
            >
              <svg
                aria-hidden
                fill="none"
                height="20"
                viewBox="0 0 20 20"
                width="20"
              >
                <path
                  d="M5 5l10 10M15 5L5 15"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.75"
                />
              </svg>
            </button>

            <section
              aria-labelledby="email-first-heading"
              className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-6 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)]"
            >
              <h1
                className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
                id="email-first-heading"
              >
                {detail?.title ?? "Welcome back"}
              </h1>
              {detail?.subtitle ? (
                <p className="mt-2 text-center text-[15px] leading-[20px] text-[#6f6f6f]">
                  {detail.subtitle}
                </p>
              ) : null}

              <form noValidate className="mt-6" onSubmit={handleSubmit}>
                <label
                  className="block text-[14px] leading-[18px] text-[#6f6f6f]"
                  htmlFor="email-first-input"
                >
                  Email
                </label>
                <div className="relative mt-2">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6f6f]"
                  >
                    <HugeiconsIcon icon={Mail01Icon} size={18} />
                  </span>
                  <input
                    autoFocus
                    required
                    aria-invalid={error ? true : undefined}
                    autoComplete="email"
                    className={`h-[52px] w-full rounded-[10px] bg-[#f7f7f7] pl-10 pr-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40 ${
                      error ? "ring-2 ring-[#f12c23]/50" : ""
                    }`}
                    id="email-first-input"
                    inputMode="email"
                    placeholder="Enter your email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                  />
                </div>
                {error ? (
                  <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  className="mt-5 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
                  disabled={submitting}
                  type="submit"
                >
                  {submitting
                    ? "Checking…"
                    : (detail?.submitLabel ?? "Log in with email")}
                </button>
                <p className="mt-4 text-center text-[13px] leading-5 text-[#7a7a7a]">
                  By creating an account, you agree to our{" "}
                  <Link
                    className="text-[#f12c23] underline underline-offset-2 hover:opacity-80"
                    href={ROUTES.LEGAL.TERMS}
                    target="_blank"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="text-[#f12c23] underline underline-offset-2 hover:opacity-80"
                    href={ROUTES.LEGAL.PRIVACY}
                    target="_blank"
                  >
                    Privacy Policy
                  </Link>
                  .
                </p>
              </form>
            </section>
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

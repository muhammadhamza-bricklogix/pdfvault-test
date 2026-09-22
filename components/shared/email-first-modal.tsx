"use client";

import { useSignIn } from "@clerk/nextjs";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Modal } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { dispatchLoginToDownloadModal } from "@/components/shared/login-to-download-modal";
import { runAutoSignup } from "@/lib/client/auth/auto-signup";
import { usePdfEditorStore } from "@/lib/client/stores";
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
  /**
   * When set, the auto-signup flow (item #5 in the modal's docstring)
   * uploads this file — the PDF with all Fabric edits burned in —
   * via the authenticated `/documents/upload` endpoint AFTER the
   * Clerk ticket sign-in but BEFORE `signIn.finalize`, then calls
   * `POST /auth/quick-signup/notify` with the resulting `docId` so
   * the Customer.io welcome email's CTA links straight to the
   * composer with the file already loaded. `id=<docId>` is also
   * appended to the finalize redirect so the composer loads from
   * cloud on the same-session return (skips the IDB-restore path in
   * the hydrator). Not set → runAutoSignup falls through to the
   * legacy IDB-hydrator flow, and the welcome email lands with the
   * dashboard fallback URL. Editor `Done → Download` sets this via
   * `useExportEditor`; other callers (compress, password) leave it
   * empty.
   */
  bakedFile?: File;
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
 * Email-first modal (2026-08-31 update):
 *
 *   1. Signed-out user clicks Done / Download in the editor
 *   2. This modal opens with just an email input + "Download file"
 *   3. User submits — we probe Clerk with `signIn.create({ identifier })`
 *   4. Account EXISTS → hand off to LoginToDownloadModal so the user
 *      logs in the normal way (Google or email code) before paywall
 *   5. Account is NEW → auto-signup: `/api/auth/quick-signup` creates
 *      the Clerk user (verified email + random password emailed by the
 *      backend), returns a one-time ticket, we `signIn.create({strategy:
 *      "ticket"})` → `setActive` → `window.location.assign(returnTo)`
 *      per auth invariant #15. Manual /sign-up card is untouched.
 */
export function EmailFirstModal() {
  const { signIn } = useSignIn();
  const [detail, setDetail] = useState<EmailFirstModalDetail | null>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const scrollEmailInputIntoView = useCallback(
    (block: ScrollLogicalPosition = "nearest") => {
      emailInputRef.current?.scrollIntoView({
        behavior: "smooth",
        block,
        inline: "nearest",
      });
    },
    [],
  );

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

  // Focus without letting the browser scroll the page to bring the input
  // into view — the modal is already centered via CSS. On mobile the
  // keyboard opens AFTER focus and shrinks the visible area, which can
  // push the input above the fold; re-run scrollIntoView (targets the
  // modal's own scrollable container, not the page) on visualViewport
  // resize so the input stays reachable once the keyboard settles.
  useEffect(() => {
    if (!detail) return;
    emailInputRef.current?.focus({ preventScroll: true });
    requestAnimationFrame(() => scrollEmailInputIntoView("nearest"));
    window.setTimeout(() => scrollEmailInputIntoView("center"), 250);

    const vv = window.visualViewport;

    if (!vv) return;

    const handleViewportResize = () => {
      if (document.activeElement !== emailInputRef.current) return;

      scrollEmailInputIntoView("center");
    };

    vv.addEventListener("resize", handleViewportResize);

    return () => vv.removeEventListener("resize", handleViewportResize);
  }, [detail, scrollEmailInputIntoView]);

  const close = useCallback(() => {
    setDetail(null);
    setSubmitting(false);
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    // QA 2026-09-06: valid email submitted → modal stuck at
    // "Checking…" forever, no error surfaces. `signIn` from
    // `useSignIn()` can be transiently null right after the modal
    // opens (Clerk client is still hydrating). The pre-existing
    // guard `if (!signIn || submitting) return` silently early-
    // returned without resetting `submitting`, so a rapid click
    // in that window bricked the button. Now we set `submitting=true`
    // FIRST so the guard below can clear it on the null branch and
    // the user isn't stranded.
    setError(null);
    setSubmitting(true);

    const trimmed = email.trim();

    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address.");
      setSubmitting(false);

      return;
    }

    if (!signIn) {
      setError(
        "Sign-in service is still loading. Please try again in a moment.",
      );
      setSubmitting(false);

      return;
    }

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
      // Auto-create the Clerk user in the background (verified email +
      // random password emailed by the backend), then sign the user in
      // via a one-time ticket and hard-navigate to `redirectUrl`. The
      // hydrator (items #8–12) restores the pending file on return and
      // re-fires the queued export event; the paywall opens back in the
      // editor. Manual /sign-up card is unchanged — this is a
      // download-flow-only shortcut.
      if (code === "form_identifier_not_found") {
        const returnTo = detail?.redirectUrl ?? ROUTES.APP.DASHBOARD;

        try {
          await signIn.reset();
        } catch {
          /* best-effort */
        }

        // Pull the file name straight from the editor store rather
        // than plumbing it through the modal's detail — the file that
        // triggered Download is always the store's current file, and
        // the email-first modal is only ever opened from that path.
        // Rendered as `{{event.file_name}}` in the CIO template so the
        // welcome email tells the user what they were editing.
        const editorFile = usePdfEditorStore.getState().file;

        const outcome = await runAutoSignup({
          email: trimmed,
          redirectUrl: returnTo,
          signIn,
          fileName: editorFile?.name,
          // Forward the pre-baked file (Fabric edits burned in) so
          // runAutoSignup can upload it right after ticket sign-in and
          // pass the resulting docId into `POST /auth/quick-signup/notify`
          // — that makes the welcome email's CTA land the user in the
          // composer with their edited file already loaded, instead of
          // a generic dashboard link. Not every caller of this modal
          // bakes ahead of time (compress / password / etc.), so this
          // is optional; runAutoSignup falls back to the IDB-restore
          // path when absent.
          bakedFile: detail?.bakedFile,
        });

        if (outcome.kind === "created") {
          close();

          return;
        }

        if (outcome.kind === "exists") {
          const previousDetail = detail;

          dispatchLoginToDownloadModal({
            email: trimmed,
            redirectUrl: detail?.redirectUrl,
            emailFirstDetail: previousDetail
              ? { ...previousDetail, initialEmail: trimmed }
              : undefined,
          });
          close();

          return;
        }

        setError(outcome.message);

        return;
      }

      // Any other probe error (rate limit, network hiccup, unknown
      // code) — surface a retry message. Falling through to auto-signup
      // would risk creating an account for a user whose probe was
      // interrupted for an unrelated reason.
      logger.warn("email_first.probe: unexpected code", { code });
      setError("Something went wrong. Please try again.");
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
        <Modal.Dialog className="!w-fit !max-w-[min(680px,calc(100vw-32px))] overflow-visible bg-transparent p-0 shadow-none">
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
              className="box-border w-[min(620px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-6 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)]"
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
                    ref={emailInputRef}
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
                    onFocus={() => scrollEmailInputIntoView("nearest")}
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
                    className="text-[#7a7a7a] underline underline-offset-2 hover:text-[#1a1c21]"
                    href={ROUTES.LEGAL.TERMS}
                    target="_blank"
                  >
                    Terms and Conditions
                  </Link>{" "}
                  and{" "}
                  <Link
                    className="text-[#7a7a7a] underline underline-offset-2 hover:text-[#1a1c21]"
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

"use client";

import { useSignIn } from "@clerk/nextjs";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Modal } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import { dispatchAuthModal } from "@/components/shared/auth-modal";
import {
  dispatchEmailFirstModal,
  type EmailFirstModalDetail,
} from "@/components/shared/email-first-modal";
import { GoogleIcon } from "@/components/sections/auth/auth-oauth";
import { rememberAuthReturn } from "@/lib/client/auth/auth-return";
import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { ROUTES } from "@/lib/shared/constants/routes";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

export type LoginToDownloadModalDetail = {
  /** Email captured by the email-first modal probe. */
  email: string;
  /** Post-auth destination — piped through to LoginCard / OAuth callback. */
  redirectUrl?: string;
  /**
   * Original email-first-modal detail. Used by the Back button so we
   * can restore that modal with its title / subtitle / submitLabel
   * intact and the email pre-filled.
   */
  emailFirstDetail?: EmailFirstModalDetail;
};

const EVENT_NAME = "app:login-to-download-modal";

export function dispatchLoginToDownloadModal(
  detail: LoginToDownloadModalDetail,
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

/**
 * Second-stage modal for the editor Done → Download flow (existing
 * account path). Fires when the email-first modal's probe returns a
 * hit; renders the user's captured email + Google + email-code login
 * options. Splitting this out of the LoginCard keeps the copy
 * ("Log in to download your file") and the back-to-download link
 * scoped to the download journey without polluting the general
 * AuthModal shell.
 */
export function LoginToDownloadModal() {
  const { signIn } = useSignIn();
  const [detail, setDetail] = useState<LoginToDownloadModalDetail | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<LoginToDownloadModalDetail>;

      setDetail(custom.detail ?? null);
      setOauthLoading(false);
      setEmailLoading(false);
    };

    window.addEventListener(EVENT_NAME, onOpen);

    return () => window.removeEventListener(EVENT_NAME, onOpen);
  }, []);

  const close = useCallback(() => {
    setDetail(null);
    setOauthLoading(false);
    setEmailLoading(false);
  }, []);

  const goBack = useCallback(() => {
    const previous = detail?.emailFirstDetail ?? {};
    const emailForRestore = detail?.email;

    close();
    // Re-open the email-first modal with the same context + the
    // email pre-filled so the user doesn't have to retype it.
    dispatchEmailFirstModal({
      ...previous,
      initialEmail: emailForRestore,
    });
  }, [close, detail]);

  const onGoogle = async () => {
    if (!signIn || oauthLoading) return;
    logger.event(EVENTS.SIGNIN_OAUTH_START, "info", { provider: "google" });
    setOauthLoading(true);

    try {
      const returnTo = detail?.redirectUrl ?? ROUTES.APP.DASHBOARD;
      const callbackWithReturn = `${ROUTES.AUTH.SSO_CALLBACK}?redirect_url=${encodeURIComponent(returnTo)}`;

      // signIn.sso does a full-page redirect to Google — trip the
      // beforeunload guard the same way LoginCard does when opened
      // from the editor with unsaved edits.
      suppressNextUnload();
      rememberAuthReturn(returnTo);
      await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: callbackWithReturn,
        redirectUrl: returnTo,
      });
    } catch (err) {
      logger.captureError(err, "login_to_download.oauth_google");
      setOauthLoading(false);
    }
  };

  const onLogInWithEmail = () => {
    if (emailLoading) return;
    setEmailLoading(true);
    dispatchAuthModal({
      mode: "login",
      redirectUrl: detail?.redirectUrl,
      email: detail?.email,
      // LoginCard's mount effect fires `signIn.emailCode.sendCode`
      // once — the code send is a direct downstream consequence of
      // this click.
      autoSendCode: true,
    });
    // Give AuthModal a tick to mount its listener before we unmount.
    window.setTimeout(close, 100);
  };

  const onSwitchToSignup = () => {
    dispatchAuthModal({
      mode: "signup",
      redirectUrl: detail?.redirectUrl,
      email: detail?.email,
    });
    close();
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
          <section
            aria-labelledby="login-to-download-heading"
            className="relative box-border w-[min(480px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-6 pt-6 shadow-[0_8px_24px_rgba(28,46,51,0.08)]"
          >
            {/* Back button — top left. Sends the user back to the
                email-first modal with their email prefilled. */}
            <button
              aria-label="Back"
              className="absolute left-4 top-4 inline-flex size-9 items-center justify-center rounded-lg border border-[#e1ebed] text-[#5f5f5f] transition-colors hover:bg-default-100 hover:text-[#1a1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              type="button"
              onClick={goBack}
            >
              <svg
                aria-hidden
                fill="none"
                height="18"
                viewBox="0 0 20 20"
                width="18"
              >
                <path
                  d="M12 4l-6 6 6 6"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              </svg>
            </button>

            {/* Close (X) — top right */}
            <button
              aria-label="Close"
              className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-[#8a8a8a] transition-colors hover:bg-default-100 hover:text-[#1a1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
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

            <h1
              className="mt-1 text-center text-[22px] font-semibold leading-[28px] text-[#1a1c21]"
              id="login-to-download-heading"
            >
              Log in to download your file
            </h1>

            {/* QA 2026-09-08 (product spec): green success banner reassures
                the returning user that we recognised their email — reduces
                the "why does this want a password" friction and increases
                completion vs. a plain header. */}
            <div
              className="mt-4 flex items-center gap-2 rounded-[10px] border border-[#16a34a]/25 bg-[#16a34a]/10 px-3 py-2 text-[13px] font-medium text-[#15803d]"
              role="status"
            >
              <svg
                aria-hidden
                fill="none"
                height="16"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="16"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>
                We found your account! Log in to continue downloading your file.
              </span>
            </div>

            <div className="mt-6 space-y-4">
              <button
                className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-[10px] border border-[#e1ebed] bg-white text-[15px] font-medium text-[#1a1c21] transition-colors hover:bg-default-100 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
                disabled={oauthLoading || emailLoading}
                type="button"
                onClick={onGoogle}
              >
                <GoogleIcon />
                {oauthLoading
                  ? "Connecting to Google…"
                  : "Continue with Google"}
              </button>

              <div className="flex items-center gap-3 text-[13px] text-[#8a8a8a]">
                <span aria-hidden className="h-px flex-1 bg-[#e1ebed]" />
                <span>or</span>
                <span aria-hidden className="h-px flex-1 bg-[#e1ebed]" />
              </div>

              <div>
                <label
                  className="block text-[14px] leading-[18px] text-[#6f6f6f]"
                  htmlFor="login-to-download-email"
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
                    readOnly
                    className="h-[52px] w-full rounded-[10px] border border-[#e1ebed] bg-white pl-10 pr-3 text-[16px] text-[#5f5f5f] outline-none"
                    id="login-to-download-email"
                    type="email"
                    value={detail?.email ?? ""}
                  />
                </div>
              </div>

              <button
                className="flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
                disabled={oauthLoading || emailLoading}
                type="button"
                onClick={onLogInWithEmail}
              >
                {emailLoading
                  ? "Sending verification code…"
                  : "Log in with email"}
              </button>
            </div>

            <p className="mt-5 text-center text-[15px] text-[#5f5f5f]">
              Do not have an account yet?{" "}
              <button
                className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
                type="button"
                onClick={onSwitchToSignup}
              >
                Sign up
              </button>
            </p>
          </section>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

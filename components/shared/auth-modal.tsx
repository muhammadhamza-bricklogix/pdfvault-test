"use client";

import { Modal } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import { LoginCard } from "@/components/sections/auth/login-card";
import { SignupCard } from "@/components/sections/auth/signup-card";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

export type AuthModalMode = "login" | "signup";

export type AuthModalDetail = {
  /** Which card to open first. Users can switch via the in-card link. */
  mode?: AuthModalMode;
  /**
   * Post-signin destination. Passed down to LoginCard / SignupCard as
   * their `redirectUrl` prop. Finalize still uses
   * `window.location.assign(…)` inside the cards (CLAUDE.md item #15).
   * When omitted, the cards fall back to `useSearchParams().get('redirect_url')`.
   */
  redirectUrl?: string;
};

/**
 * Fire from anywhere to open the AuthModal. Mirrors `dispatchSignInPrompt`
 * so callers don't need to plumb open-state through context.
 */
export function dispatchAuthModal(detail: AuthModalDetail = {}) {
  if (typeof window === "undefined") return;
  logger.event(EVENTS.SIGNIN_PROMPT_DISPATCHED, "info", {
    destination: detail.mode ?? "login",
    hasRedirect: Boolean(detail.redirectUrl),
  });
  window.dispatchEvent(new CustomEvent("app:auth-modal", { detail }));
}

/**
 * Global auth modal. Mounted once at the app-provider level. Wraps the
 * existing `LoginCard` / `SignupCard` so their flows (email/password,
 * OTP, 2FA, OAuth, verification-code step) work unchanged — the only
 * difference from the standalone `/sign-in` and `/sign-up` pages is
 * the container and the in-card "switch mode" link.
 *
 * The cards still call `window.location.assign(returnUrl)` after
 * finalize, so the 21-item auth chain (hydrator restore, tool
 * auto-launch, iOS Safari cookie commit) stays intact. This modal is
 * purely a new entry surface — it does NOT change the finalize path.
 */
export function AuthModal() {
  const [detail, setDetail] = useState<AuthModalDetail | null>(null);
  // Local mode mirrors detail.mode initially so the in-card "switch"
  // link can flip tabs without dispatching a new event.
  const [mode, setMode] = useState<AuthModalMode>("login");

  useEffect(() => {
    const onOpen = (event: Event) => {
      const custom = event as CustomEvent<AuthModalDetail>;
      const next = custom.detail ?? {};

      setDetail(next);
      setMode(next.mode ?? "login");
    };

    window.addEventListener("app:auth-modal", onOpen);

    return () => window.removeEventListener("app:auth-modal", onOpen);
  }, []);

  const close = useCallback(() => {
    logger.event(EVENTS.SIGNIN_PROMPT_CANCELLED, "info");
    setDetail(null);
  }, []);

  const isOpen = detail !== null;

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog
          // The cards themselves cap width at ~446/447px; the modal
          // dialog matches so the surrounding chrome sits flush against
          // the card. `p-0` because the cards own their own padding.
          className="!w-[min(500px,calc(100vw-32px))] !max-w-[500px] overflow-hidden rounded-2xl bg-transparent p-0 shadow-none"
        >
          {/* No Modal.Header — the cards already render their own H1.
              Close trigger sits absolute so it hovers over the card's
              rounded corner without pushing the layout. */}
          <div className="relative">
            <div className="absolute right-3 top-3 z-10">
              <Modal.CloseTrigger />
            </div>
            {mode === "login" ? (
              <LoginCard
                redirectUrl={detail?.redirectUrl}
                onSwitchToSignup={() => setMode("signup")}
              />
            ) : (
              <SignupCard
                redirectUrl={detail?.redirectUrl}
                onSwitchToLogin={() => setMode("login")}
              />
            )}
          </div>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

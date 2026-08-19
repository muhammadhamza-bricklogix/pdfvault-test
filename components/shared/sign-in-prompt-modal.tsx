"use client";

import { Button, Modal } from "@heroui/react";
import { useCallback, useEffect, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

export type SignInPromptDetail = {
  title?: string;
  description?: string;
  redirectUrl?: string;
  confirmLabel?: string;
  /**
   * Where the confirm button sends the user. Defaults to `"sign-in"`;
   * callers that would rather route new users into account creation
   * (e.g. the download-then-sign-up flow for a guest export) can pass
   * `"sign-up"` and set `confirmLabel` accordingly.
   */
  destination?: "sign-in" | "sign-up";
};

/**
 * Fires a "sign-in required" prompt anywhere in the app without
 * threading a callback through React context. Producers call
 * `dispatchSignInPrompt({ ... })` — this module-scoped modal listens
 * for the event and opens.
 */
export function dispatchSignInPrompt(detail: SignInPromptDetail) {
  if (typeof window === "undefined") return;
  logger.event("signin_prompt.dispatched", "info", {
    destination: detail.destination ?? "sign-in",
    hasRedirect: Boolean(detail.redirectUrl),
  });
  window.dispatchEvent(new CustomEvent("app:sign-in-prompt", { detail }));
}

/**
 * Modal shown before a full-page redirect to `/sign-in`. Gives the
 * user a chance to cancel (stay on the current editor / page with
 * local edits) or confirm (leave the page for auth and come back via
 * `redirect_url`). Softer than the previous "toast + immediate redirect"
 * pattern — the user always knows what's about to happen.
 *
 * Mount once at the app-provider level. Any component can trigger it
 * via `dispatchSignInPrompt({ ... })`.
 */
export function SignInPromptModal() {
  const [detail, setDetail] = useState<SignInPromptDetail | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const custom = event as CustomEvent<SignInPromptDetail>;

      setDetail(custom.detail ?? {});
    };

    window.addEventListener("app:sign-in-prompt", onPrompt);

    return () => window.removeEventListener("app:sign-in-prompt", onPrompt);
  }, []);

  const close = useCallback(() => {
    logger.event("signin_prompt.cancelled", "info");
    setDetail(null);
  }, []);

  const confirm = useCallback(() => {
    if (typeof window === "undefined") return;
    const returnTo =
      detail?.redirectUrl ??
      `${window.location.pathname}${window.location.search}`;
    const dest =
      detail?.destination === "sign-up"
        ? ROUTES.AUTH.SIGN_UP
        : ROUTES.AUTH.SIGN_IN;

    logger.event("signin_prompt.confirmed", "info", {
      destination: detail?.destination ?? "sign-in",
    });
    window.location.assign(
      `${dest}?redirect_url=${encodeURIComponent(returnTo)}`,
    );
  }, [detail]);

  const isOpen = detail !== null;
  const title = detail?.title ?? "Sign in to continue";
  const description =
    detail?.description ??
    "You'll be taken to the sign-in page. After signing in we'll bring you right back here to finish.";
  const confirmLabel = detail?.confirmLabel ?? "Sign in";

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Modal.Container className="items-center justify-center p-4">
        <Modal.Dialog className="w-full overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-30px_rgba(23,23,23,0.35)] sm:max-w-[440px] dark:bg-content1">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading className="pv-heading text-[var(--pv-text-strong,#1a1c21)]">
              {title}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-[13px] leading-relaxed text-[var(--pv-text-body,#5c5c5c)]">
              {description}
            </p>
          </Modal.Body>
          <Modal.Footer className="gap-2">
            <Button variant="secondary" onPress={close}>
              Cancel
            </Button>
            <Button variant="primary" onPress={confirm}>
              {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

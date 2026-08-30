"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

/**
 * Event name matches `dispatchAuthModal` in `components/shared/auth-modal.tsx`.
 * Both must stay in sync or nothing will happen when a Login button is clicked.
 */
const AUTH_MODAL_EVENT = "app:auth-modal";

/**
 * Landing/marketing-safe host for the shared AuthModal.
 *
 * Root layout no longer ships `<ClerkProvider>`, which means the modal
 * can't be statically mounted at the root (its LoginCard/SignupCard
 * children need a Clerk context to render). This host lives at root
 * inside `AppProviders` — renders NOTHING until it sees the first
 * `app:auth-modal` event, at which point it dynamic-imports
 * `StandaloneAuthModal` (which brings its own `<ClerkProvider>` +
 * `<AuthModal />`). `clerk.browser.js` is fetched from Clerk's CDN
 * only when the wrapper mounts.
 *
 * Event-race note: the first `app:auth-modal` event fires from
 * `dispatchAuthModal(detail)` at click time, but AuthModal's own
 * listener isn't attached until StandaloneAuthModal has finished
 * dynamic-importing (~100–300 ms on cold cache). To bridge that gap
 * we buffer the first event's detail in a ref and re-dispatch it on
 * the next tick after mount, so AuthModal's listener catches it.
 *
 * Prefetch strategy: on idle, warm the chunk by kicking off the
 * dynamic import without mounting anything. This is cheap (module
 * download + parse only, no React tree, no Clerk init) and makes the
 * first user click open the modal with negligible extra lag. The
 * `clerk.pdfvault.ai` preconnect in the root layout is what keeps
 * the on-click Clerk SDK fetch fast.
 *
 * Nested-provider note: on Clerk-having layouts (dashboard, tools,
 * editor) that ALSO wrap their subtree in `<ClerkProvider>`, this
 * host still mounts and its StandaloneAuthModal nests a second
 * ClerkProvider inside the outer one. Clerk supports nested providers
 * (innermost wins for `useAuth()`); both share the same `__session`
 * cookie so there is no real state divergence.
 */
const StandaloneAuthModal = dynamic(
  () =>
    import("@/components/shared/standalone-auth-modal").then(
      (m) => m.StandaloneAuthModal,
    ),
  { ssr: false, loading: () => null },
);

export function LazyAuthModalHost() {
  const [shouldMount, setShouldMount] = useState(false);
  const pendingDetailRef = useRef<CustomEvent["detail"] | null>(null);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const custom = event as CustomEvent;

      if (!shouldMount) {
        // Buffer the first click's detail so we can re-dispatch it once
        // AuthModal has finished loading and its own listener is live.
        pendingDetailRef.current = custom.detail ?? {};
        setShouldMount(true);
      }
    };

    window.addEventListener(AUTH_MODAL_EVENT, handleOpen);

    const idle = (
      window as Window & {
        requestIdleCallback?: (
          cb: () => void,
          opts?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    const prefetch = () => {
      void import("@/components/shared/standalone-auth-modal").catch(
        () => undefined,
      );
    };

    if (typeof idle === "function") {
      idleId = idle(prefetch, { timeout: 4000 });
    } else {
      timeoutId = window.setTimeout(prefetch, 2500);
    }

    return () => {
      window.removeEventListener(AUTH_MODAL_EVENT, handleOpen);
      const cancelIdle = (
        window as Window & {
          cancelIdleCallback?: (id: number) => void;
        }
      ).cancelIdleCallback;

      if (idleId !== undefined && typeof cancelIdle === "function") {
        cancelIdle(idleId);
      }
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [shouldMount]);

  useEffect(() => {
    if (!shouldMount) return;
    const detail = pendingDetailRef.current;

    if (!detail) return;

    // Give AuthModal a tick to attach its own listener after mount,
    // then re-fire the original event so it opens with the correct
    // mode + redirectUrl.
    const raf = requestAnimationFrame(() => {
      pendingDetailRef.current = null;
      window.dispatchEvent(new CustomEvent(AUTH_MODAL_EVENT, { detail }));
    });

    return () => cancelAnimationFrame(raf);
  }, [shouldMount]);

  if (!shouldMount) return null;

  return <StandaloneAuthModal />;
}

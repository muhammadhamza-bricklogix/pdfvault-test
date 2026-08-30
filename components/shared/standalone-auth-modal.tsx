"use client";

import { ClerkProvider } from "@clerk/nextjs";

import { AuthModal } from "@/components/shared/auth-modal";

/**
 * `AuthModal` wrapped in its OWN `<ClerkProvider>` so it can be loaded on
 * demand from routes that don't ship Clerk in their initial bundle (the
 * landing / marketing / legal surfaces).
 *
 * Landing header's Login button dispatches `auth-modal:open` →
 * `LazyAuthModalHost` catches the event → dynamic-imports THIS file →
 * Next fetches the Clerk vendor chunk + this wrapper + `AuthModal` +
 * (transitively) LoginCard/SignupCard. `clerk.browser.js` is fetched
 * only when the wrapper mounts.
 *
 * Config props mirror the previous root-layout `<ClerkProvider>` so the
 * sign-in / sign-up redirect flow (auth-chain item #15) behaves
 * identically no matter which surface opens the modal.
 */
export function StandaloneAuthModal() {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/dashboard"
      signUpUrl="/sign-up"
    >
      <AuthModal />
    </ClerkProvider>
  );
}

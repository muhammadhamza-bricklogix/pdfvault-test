"use client";

import type { ReactNode } from "react";

import { createContext, useContext } from "react";

import { usePaywall } from "@/lib/client/hooks/billing/use-paywall";

import { PaywallModal } from "./PaywallModal";

type PaywallGuard = (action: () => void | Promise<void>) => Promise<void>;

interface PaywallContextValue {
  entitled: boolean;
  isLoading: boolean;
  /**
   * Wraps a gated action. If the user is already entitled the action
   * runs immediately. Otherwise the paywall modal opens and the action
   * is queued until the payment `success` event fires.
   */
  guard: PaywallGuard;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

/**
 * Mount ONCE, high in the tree (dashboard shell + landing shell). All
 * gated buttons downstream call `usePaywallGuard()` to wrap their click
 * handler. Keeping the modal at the root avoids the "modal inside a
 * scrollable pane" quirk on iOS Safari.
 */
export function PaywallProvider({ children }: { children: ReactNode }) {
  const {
    isOpen,
    entitled,
    isLoading,
    guard,
    preview,
    close,
    onPaymentSuccess,
  } = usePaywall();

  return (
    <PaywallContext.Provider value={{ entitled, isLoading, guard }}>
      {children}
      <PaywallModal
        isOpen={isOpen}
        preview={preview}
        onClose={close}
        onPaymentSuccess={onPaymentSuccess}
      />
    </PaywallContext.Provider>
  );
}

export function usePaywallGuard(): PaywallContextValue {
  const ctx = useContext(PaywallContext);

  if (!ctx) {
    throw new Error(
      "usePaywallGuard must be used inside a <PaywallProvider>. Mount it in AppProviders or the section shell.",
    );
  }

  return ctx;
}

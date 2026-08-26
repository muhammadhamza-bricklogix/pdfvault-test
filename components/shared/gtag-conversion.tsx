"use client";

import { useEffect } from "react";

export function GtagConversion({ sendTo }: { sendTo: string }) {
  useEffect(() => {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "conversion", { send_to: sendTo });
  }, [sendTo]);

  return null;
}

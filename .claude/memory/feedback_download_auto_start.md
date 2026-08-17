---
name: feedback-download-auto-start
description: "User expects paywall-triggered downloads (and other queued actions) to fire automatically after payment success, not require a manual \"Start editing\" click."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c529a735-2d03-40d7-bffc-33ce2f4afcb9
---

`PaywallModal`'s `SuccessStep` auto-dismisses after 2000ms via `useEffect(() => setTimeout(onFinishRef.current, 2000), [])`. The user still sees "You're all set!" briefly, then the modal closes and the queued action (download / convert / share / etc.) runs automatically. The "Start editing →" button remains for users who want to skip the delay.

**Why:** User explicitly said (2026-07-30): "the .99 cents pay to download should appear and when they paid, it automatically downloads their doc". They expect the flow after payment to be silent — the user's mental model is "I paid, therefore the thing I was doing happens now". A manual click gate feels like extra friction on top of the payment.

**How to apply:**
- Do NOT remove the auto-dismiss timer from `SuccessStep`. If the modal ever needs to show longer for legal / receipt reasons, negotiate the timer (bump to 3–5 s) rather than removing it
- Do NOT add extra confirmation steps between `handleIframeSuccess` → `setStep("success")` and the auto-fired `onFinish`
- The `finish()` prop still calls ONLY `onPaymentSuccess()` (not `onClose`) — invariant 7 of the CLAUDE.md auth chain still holds

See [[2026-07-30-signout-edit-persistence]] Bug 2 for the reasoning trail.

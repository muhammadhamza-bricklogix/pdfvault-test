---
name: project-auth-link-redirect-url
description: "Cross-nav links between /sign-in ↔ /sign-up must forward the current page's redirect_url. Without it, users hop screens and lose their pending file after auth."
metadata: 
  node_type: memory
  type: project
  originSessionId: c529a735-2d03-40d7-bffc-33ce2f4afcb9
---

`components/sections/auth/login-card.tsx` "Sign Up" link and `components/sections/auth/signup-card.tsx` "Sign In" link both conditionally append `?redirect_url=<encoded>` when the page's own redirect target is non-default (i.e., not `/dashboard`).

**Why:** A signed-out user clicking Download on `/pdf-composer` → `SignInPromptModal` → arrives at `/sign-in?redirect_url=/pdf-composer?export=pdf`. If they realise they don't have an account and click "Sign Up", the plain link `<Link href="/sign-up">` drops the redirect_url. `signup-card.tsx`'s `afterSignUpPath` falls back to `ROUTES.APP.DASHBOARD` → user lands on dashboard after signup → PDF and edits are lost (see [[project_pending_editor_state]] for what IDB restores when the return URL IS correct).

**How to apply:**
- Every auth screen's "already have an account?" / "don't have an account?" link MUST preserve `redirect_url` if one is present
- The pattern: check `afterSignInPath !== ROUTES.APP.DASHBOARD` (or the sign-up equivalent), then build `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(afterSignInPath)}` conditionally
- This extends CLAUDE.md's 21-item auth chain — item 15 covers the finalize navigation (`window.location.assign` for cookie commit), this covers the cross-nav case that happens BEFORE finalize

See [[2026-07-30-signout-edit-persistence]] Bug 1 for the specific flow that broke.

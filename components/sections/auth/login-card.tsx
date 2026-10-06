"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

import { OtpBoxes } from "@/components/ui/form/otp-boxes";
import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { parseLocalePrefix } from "@/lib/shared/constants/locale-map";
import { ROUTES } from "@/lib/shared/constants/routes";
import { authSignInSchema } from "@/lib/shared/schemas/auth/sign-in.schema";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

import { GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

/**
 * Stable Turnstile mount point for the signin-code flow (email OTP).
 * Memoised so React never re-renders it (prevents Turnstile 300010).
 * Kept BARE — no `mt-*` margin, no `min-h-*` reserved height — so
 * when Clerk's dashboard has bot protection set to invisible mode
 * the div collapses to 0 height and doesn't visually gap the button
 * (QA 2026-08-30). When bot protection is visible/managed, Turnstile
 * injects an iframe and the div grows to fit its content. `w-full`
 * so the flexible widget has a non-zero WIDTH parent (0-width flex
 * parent was the earlier `getCaptchaToken` hang).
 */
const TurnstileAnchor = memo(function TurnstileAnchor() {
  return <div className="w-full" data-cl-size="flexible" id="clerk-captcha" />;
});

function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
}

/**
 * Dashboard fallback that preserves the CURRENT locale prefix. When a
 * signed-out user opens the login card from `/de/…` (or any prefixed
 * locale) without an explicit `redirect_url`, we default to
 * `/de/dashboard` instead of `/dashboard`. Otherwise the finalize
 * `window.location.assign(…)` (invariant #15) lands the user on the
 * English dashboard and the whole authenticated app flips out of the
 * locale they arrived on. Server-side / SSR path returns the raw
 * dashboard route — the client-side memo below re-evaluates once
 * `window.location` is available.
 */
function localizedDashboardFallback(): string {
  if (typeof window === "undefined") return ROUTES.APP.DASHBOARD;
  const parsed = parseLocalePrefix(window.location.pathname);

  return parsed
    ? `/${parsed.locale}${ROUTES.APP.DASHBOARD}`
    : ROUTES.APP.DASHBOARD;
}

function BackChevron() {
  return (
    <svg aria-hidden fill="none" height="14" viewBox="0 0 14 14" width="14">
      <path
        d="M9 3 5 7l4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/**
 * Extracts the first useful message from a Clerk error, falling back to a
 * generic string. Clerk throws `{ errors: [{ longMessage, message, code }] }`.
 */
function readClerkError(err: unknown, fallback: string): string {
  const first = (
    err as {
      errors?: { longMessage?: string; message?: string; code?: string }[];
    }
  )?.errors?.[0];
  const raw = first?.longMessage ?? first?.message ?? "";

  return humaniseClerkMessage(raw, first?.code) || fallback;
}

function isSessionExistsError(err: unknown): boolean {
  return (
    (err as { errors?: { code?: string }[] })?.errors?.[0]?.code ===
    "session_exists"
  );
}

function humaniseClerkMessage(raw: string, code?: string): string {
  const s = raw.toLowerCase();

  if (
    code === "form_identifier_not_found" ||
    /couldn.?t find your account/i.test(s)
  ) {
    return "We couldn't find an account with that email. Create one to get started.";
  }
  if (
    code === "form_password_incorrect" ||
    code === "form_password_not_matched" ||
    /password is incorrect|password is not correct/i.test(s)
  ) {
    return "That password isn't right. Try again or reset it.";
  }
  if (
    code === "strategy_for_user_invalid" ||
    /verification strategy is not valid/i.test(s)
  ) {
    return "This account was set up with Google. Use Continue with Google.";
  }
  if (
    code === "form_code_incorrect" ||
    /code is incorrect|didn.?t work/i.test(s)
  ) {
    return "That code doesn't match. Check your inbox or resend a new one.";
  }

  return raw;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Masks the local part of an email for the verify-step subtitle
 * ("Please check your email hou***@gmail.com."). Keeps the first three
 * chars + domain visible so the user recognises which inbox to check
 * without exposing the full identifier on a shared screen.
 */
function maskEmail(raw: string): string {
  const at = raw.indexOf("@");

  if (at <= 0) return raw;
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  const visible = local.slice(0, Math.min(3, local.length));

  return `${visible}***${domain}`;
}

// Module-scoped dedup for the auto-send code flow. Survives React 19
// StrictMode's dev-only mount→unmount→mount cycle (which resets any
// component-scope ref between the two mounts and was firing
// `signIn.emailCode.sendCode` twice per email — Clerk returned 422
// `verification_already_sent` on the second call, generating console
// noise + a stuck OTP screen. Storing by trimmed email means opening
// the modal for a DIFFERENT email later still auto-sends normally.
const autoSentEmails = new Set<string>();

// Sign-in mode.
//   - "code"     → default. Email → 6-digit OTP → verify → finalize.
//   - "password" → email + password → existing single-factor flow.
// User toggles between them via the link below the primary CTA. Either
// mode can escalate to the 2FA step when Clerk returns needs_second_factor.
type Mode = "code" | "password";

// Flow steps:
//   1. "credentials" → email (+ password when mode === "password").
//                      Submit branches on mode:
//                        - code:     signIn.emailCode.sendCode({ emailAddress })
//                                    → advance to "codeVerify".
//                        - password: signIn.password({ emailAddress, password }).
//                                    complete → finalize;
//                                    needs_second_factor → advance to "twoFactor".
//   2. "codeVerify" → 6-digit input for the first-factor email code.
//                     signIn.emailCode.verifyCode. complete → finalize;
//                     needs_second_factor → advance to "twoFactor"
//                     (invariant #16 — 2FA-enabled accounts must not silently loop back).
//   3. "twoFactor"  → preserved 2FA path (email/phone/TOTP/backup).
type Step = "credentials" | "codeVerify" | "twoFactor";

type FieldErrors = {
  email?: string;
  password?: string;
  code?: string;
  form?: string;
};

type SecondFactorStrategy =
  | "email_code"
  | "phone_code"
  | "totp"
  | "backup_code";

type LoginCardProps = {
  /**
   * Post-signin destination. When omitted, falls back to
   * `useSearchParams().get('redirect_url')` so the standalone
   * `/sign-in` page keeps working unchanged. AuthModal passes this in
   * directly because it isn't rendered under `/sign-in?redirect_url=…`.
   * Either way the finalize nav is still `window.location.assign(…)`
   * per CLAUDE.md invariant #15 — do not swap for `router.push`.
   */
  redirectUrl?: string;
  /**
   * When rendered inside a modal, calling this switches the modal's
   * mode to signup instead of navigating to `/sign-up`. When omitted
   * (standalone page), the "Sign up" link falls back to a `<Link>` so
   * the standalone route still works.
   */
  onSwitchToSignup?: () => void;
  /**
   * When rendered inside a modal, calling this switches the modal to
   * the forgot-password view instead of navigating to `/forgot-password`.
   * When omitted (standalone page), the link falls back to a `<Link>`.
   */
  onForgotPassword?: () => void;
  /**
   * Pre-fill the email field on first render. Used by the email-first
   * modal (2026-08-30) so the user doesn't have to retype an email
   * they already entered in the previous step. Falls back to "" so
   * the standalone /sign-in page behaves unchanged.
   */
  initialEmail?: string;
  /**
   * When true (and `initialEmail` is a valid email), the card
   * auto-fires `signIn.emailCode.sendCode({ emailAddress })` on
   * mount and lands the user directly on the OTP-verify step —
   * skipping the credentials form (2026-08-30 PM ask: after the
   * email-first modal confirms "We found your account", we send
   * the code automatically so the user's next screen is the code
   * boxes). Errors during the auto-send fall back to the
   * credentials form so the user can retry manually.
   */
  autoSendCode?: boolean;
};

export function LoginCard({
  redirectUrl,
  onSwitchToSignup,
  onForgotPassword,
  initialEmail,
  autoSendCode,
}: LoginCardProps = {}) {
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const searchParams = useSearchParams();

  // One-shot mount log for signin — same shape as
  // `[AUTH_DIAG] signup.mount` so you can grep both under one filter.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] signin.mount", {
      clerkLoaded: Boolean(clerk?.loaded),
      hasSignIn: Boolean(signIn),
      captchaAnchorMounted: Boolean(
        typeof document !== "undefined" &&
          document.getElementById("clerk-captcha"),
      ),
      captchaSize:
        typeof document !== "undefined"
          ? document
              .getElementById("clerk-captcha")
              ?.getAttribute("data-cl-size")
          : null,
      origin: typeof window !== "undefined" ? window.location.origin : "ssr",
      clerkPublishableKeyPrefix: (
        clerk as { publishableKey?: string } | null
      )?.publishableKey?.slice(0, 15),
    });
  }, []);

  const [mode, setMode] = useState<Mode>("code");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Second-factor state. `strategy` is picked once we detect
  // `needs_second_factor`; `code` is shared with the primary code step.
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy | null>(null);

  const headingId = useId();
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const rememberMeId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();
  const codeErrorId = useId();
  const formErrorId = useId();
  const statusId = useId();

  const afterSignInPath = useMemo(
    () =>
      safeRedirectPath(
        redirectUrl ?? searchParams.get("redirect_url"),
        localizedDashboardFallback(),
      ),
    [redirectUrl, searchParams],
  );

  // A session can already exist (e.g. signed in from another tab); continue instead of erroring.
  const continueAsSignedIn = () => {
    suppressNextUnload();
    window.location.assign(afterSignInPath);
  };

  // Post-verify navigation. Invariant #15: iOS Safari commits the Clerk
  // session cookie during a full-page navigation; router.push outruns the
  // commit and lands on middleware that reads the user as signed-out,
  // bouncing them to /sign-up. window.location.assign is required.
  const finalizeAndRedirect = async () => {
    logger.event(EVENTS.SIGNIN_FINALIZE_START, "info", {
      redirectPath: afterSignInPath,
    });
    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        // AuthModal opens on TOP of the editor (2026-08-28 unify), so
        // by the time we assign a new URL the composer still has
        // `hasUnsavedChanges === true` — user just edited before
        // clicking Done/Download. Without the suppress, the
        // `beforeunload` guard in `useEditorNavigationSave` fires the
        // browser's native "Leave site?" prompt right after sign-in
        // completes, and if the user picks "Leave" the nav can land
        // them on `/` because Clerk's redirect races the browser's
        // cancellation. `suppressNextUnload()` mirrors the pattern
        // already used by `ReloadConfirmModal`. No effect on the
        // standalone `/sign-in` page (no editor mounted, no
        // beforeunload listener).
        suppressNextUnload();
        // Log AT navigate-callback time (not after `finalize` resolves)
        // so we capture the exact moment the redirect commits. Sentry
        // may miss the OK event if the browser leaves before the
        // resolve microtask runs, but the breadcrumb still ships as
        // context on any next-page failure.
        logger.event(EVENTS.SIGNIN_FINALIZE_OK, "info", {
          redirectPath: afterSignInPath,
        });
        window.location.assign(decorateUrl(afterSignInPath));
      },
    });

    if (finalizeError) {
      logger.event(EVENTS.SIGNIN_FINALIZE_ERROR, "error", {
        errorMessage:
          finalizeError instanceof Error
            ? finalizeError.message
            : String(finalizeError),
        redirectPath: afterSignInPath,
      });
      logger.captureError(finalizeError, "signin.finalize");
      setErrors({
        form: readClerkError(finalizeError, "Couldn't finish signing you in."),
      });
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (!signIn) return;
    logger.event(EVENTS.SIGNIN_OAUTH_START, "info", { provider: "google" });
    setErrors({});
    setNotice(null);
    setOauthLoading(true);

    try {
      // See matching comment in `signup-card.onGoogle` — Clerk's stored
      // redirect state can be dropped on the OAuth round-trip on some
      // browsers, so we also carry the return URL as a query param on
      // the callback URL. The /sso-callback page reads it and forces
      // the redirect, guaranteeing the user lands back on the editor
      // (with the file + edits waiting in IDB) instead of the
      // dashboard fallback.
      const callbackWithReturn = `${ROUTES.AUTH.SSO_CALLBACK}?redirect_url=${encodeURIComponent(afterSignInPath)}`;

      // Same reason as `finalizeAndRedirect` above — signIn.sso does a
      // full-page redirect to Google, which trips `beforeunload` when
      // the modal is opened from the editor with unsaved edits.
      suppressNextUnload();
      await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: callbackWithReturn,
        redirectUrl: afterSignInPath,
      });
    } catch (err) {
      logger.captureError(err, "signin.oauth_google");
      setErrors({ form: "Something went wrong with Google sign-in." });
      setOauthLoading(false);
    }
  };

  // Adapts a supportedSecondFactors list into a preferred strategy +
  // triggers the prep call for the ones that need one (email/phone).
  const prepSecondFactor = async () => {
    const supported =
      (signIn.supportedSecondFactors as
        | { strategy: SecondFactorStrategy; emailAddressId?: string }[]
        | undefined) ?? [];
    const preferred =
      supported.find((f) => f.strategy === "email_code") ??
      supported.find((f) => f.strategy === "totp") ??
      supported.find((f) => f.strategy === "phone_code") ??
      supported[0];

    if (!preferred) {
      setErrors({
        form: "Two-factor authentication is required but no method is available. Contact support.",
      });

      return false;
    }

    setSecondFactorStrategy(preferred.strategy);

    if (preferred.strategy === "email_code") {
      const { error: sendErr } = await signIn.mfa.sendEmailCode();

      if (sendErr) {
        setErrors({
          form: readClerkError(
            sendErr,
            "Couldn't send your verification code. Try again.",
          ),
        });

        return false;
      }
      setNotice("We sent a 6-digit code to your email.");
    } else if (preferred.strategy === "phone_code") {
      const { error: sendErr } = await signIn.mfa.sendPhoneCode();

      if (sendErr) {
        setErrors({
          form: readClerkError(
            sendErr,
            "Couldn't send your verification code. Try again.",
          ),
        });

        return false;
      }
      setNotice("We sent a 6-digit code to your phone.");
    } else {
      setNotice(null);
    }

    return true;
  };

  // Fires the email OTP send call. Uses Clerk's `emailCode.sendCode`
  // future-API helper — the SDK creates the sign-in internally when
  // one isn't in progress, so we don't need a separate create step.
  const sendEmailCode = async (emailAddress: string): Promise<boolean> => {
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] signin.send_email_code.request", {
      hasEmail: Boolean(emailAddress),
      captchaAnchorMounted: Boolean(
        typeof document !== "undefined" &&
          document.getElementById("clerk-captcha"),
      ),
    });
    const { error } = await signIn.emailCode.sendCode({ emailAddress });

    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] signin.send_email_code.result", {
      hasError: Boolean(error),
      errorCode: (error as { errors?: { code?: string }[] })?.errors?.[0]?.code,
      errorMessage: (error as { errors?: { message?: string }[] })?.errors?.[0]
        ?.message,
      signInStatus: signIn.status,
    });

    if (error) {
      const code = (error as { errors?: { code?: string }[] })?.errors?.[0]
        ?.code;
      const message = (error as { errors?: { message?: string }[] })
        ?.errors?.[0]?.message;

      // Must run before the "already exists" recovery below, which would otherwise match it.
      if (code === "session_exists") {
        continueAsSignedIn();

        return false;
      }

      // Clerk returns 422 `verification_already_sent` (or a similar
      // variant) when we hit sendCode a second time in
      // the same flow — e.g. React StrictMode's dev double-mount,
      // fast double-click on Resend, or the user reopening the modal
      // while a code is still valid. The code IS in the user's
      // inbox from the first attempt, so treat this as success:
      // return true so the caller transitions to the OTP step
      // instead of surfacing a confusing "couldn't send" error.
      if (
        code === "verification_already_sent" ||
        /already sent|already exists/i.test(message ?? "")
      ) {
        // eslint-disable-next-line no-console
        console.info(
          "[AUTH_DIAG] signin.send_email_code.already_sent_recovery",
          { code, message },
        );

        return true;
      }

      const msg = readClerkError(
        error,
        "Couldn't send your verification code. Try again.",
      );

      if (code === "form_identifier_not_found") {
        setErrors({ email: msg });
      } else {
        setErrors({ form: msg });
      }

      return false;
    }

    return true;
  };

  // Auto-send verification code on mount when the email-first modal
  // handed us `autoSendCode` + a prefilled email (2026-08-30 PM ask:
  // after "We found your account" the user should land straight on
  // the OTP boxes, not the credentials form). Guarded on a ref so
  // React 19's StrictMode double-invoke doesn't fire the request
  // twice — Clerk's server responds `verification_already_sent` on
  // the second call and the SDK's `signIn.emailCode.sendCode` throws
  // a noisy error the user shouldn't see.
  const autoSentRef = useRef(false);

  useEffect(() => {
    if (autoSentRef.current) return;
    if (!autoSendCode) return;
    if (!signIn) return;
    const trimmed = (initialEmail ?? "").trim();

    if (!EMAIL_REGEX.test(trimmed)) return;
    // Module-scope guard — survives React StrictMode's dev-mode
    // double-mount (component ref resets between them, module set
    // does not). If we've already sent for this exact email in this
    // browser session, jump straight to the OTP step without hitting
    // Clerk again.
    if (autoSentEmails.has(trimmed)) {
      autoSentRef.current = true;
      // Defer the setState to a microtask so the effect doesn't
      // trigger a cascading render synchronously (react-hooks/…
      // set-state-in-effect lint rule).
      queueMicrotask(() => setStep("codeVerify"));

      return;
    }
    autoSentRef.current = true;
    autoSentEmails.add(trimmed);

    void (async () => {
      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] signin.auto_send_code.start", {
        hasEmail: true,
      });
      const sent = await sendEmailCode(trimmed);

      if (sent) {
        setStep("codeVerify");
      } else {
        // If sendEmailCode failed, unblock retries for this email so
        // the user can manually resend from the credentials form.
        autoSentEmails.delete(trimmed);
      }
    })();
    // Intentionally fire once on mount. `sendEmailCode` uses fresh
    // `signIn` from closure but only runs when signIn is truthy.
  }, []);

  const onSubmitCredentials = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!signIn) return;
    if (clerk?.isSignedIn) {
      continueAsSignedIn();

      return;
    }

    const trimmedEmail = email.trim();

    // Validate email in both modes. Password only in password mode —
    // authSignInSchema requires both, so we branch here to keep the
    // schema untouched.
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setNotice(null);
      setErrors({ email: "Enter a valid email address." });

      return;
    }

    if (mode === "password") {
      const parsed = authSignInSchema.safeParse({
        emailAddress: trimmedEmail,
        password,
      });

      if (!parsed.success) {
        const flat = parsed.error.flatten().fieldErrors;

        setNotice(null);
        setErrors({
          email: flat.emailAddress?.[0],
          password: flat.password?.[0],
        });

        return;
      }
    }

    setEmail(trimmedEmail);
    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      if (mode === "code") {
        // Passwordless: single-shot send. Clerk's future API resolves
        // the account, chooses the email_code first factor, and mails
        // the code in one call.
        const sent = await sendEmailCode(trimmedEmail);

        if (!sent) {
          setSubmitting(false);

          return;
        }

        logger.event(EVENTS.SIGNIN_CODE_SENT, "info");
        setCode("");
        setStep("codeVerify");
        setNotice(`We sent a 6-digit code to ${maskEmail(trimmedEmail)}.`);
        setSubmitting(false);

        return;
      }

      // mode === "password"
      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] signin.password.request", {
        hasEmail: Boolean(trimmedEmail),
        hasPassword: Boolean(password),
        captchaAnchorMounted: Boolean(
          typeof document !== "undefined" &&
            document.getElementById("clerk-captcha"),
        ),
      });
      const { error: createError } = await signIn.password({
        emailAddress: trimmedEmail,
        password,
      });

      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] signin.password.result", {
        hasError: Boolean(createError),
        errorCode: (createError as { errors?: { code?: string }[] })
          ?.errors?.[0]?.code,
        errorMessage: (createError as { errors?: { message?: string }[] })
          ?.errors?.[0]?.message,
        signInStatus: signIn.status,
        needs2FA: signIn.status === "needs_second_factor",
      });

      if (createError) {
        if (isSessionExistsError(createError)) {
          continueAsSignedIn();

          return;
        }
        const msg = readClerkError(
          createError,
          "Couldn't sign you in. Please try again.",
        );
        const code = (createError as { errors?: { code?: string }[] })
          ?.errors?.[0]?.code;

        if (
          code === "form_password_incorrect" ||
          code === "form_password_not_matched"
        ) {
          setErrors({ password: msg });
        } else if (code === "form_identifier_not_found") {
          setErrors({ email: msg });
        } else {
          setErrors({ form: msg });
        }
        setSubmitting(false);

        return;
      }

      if (signIn.status === "complete") {
        logger.event(EVENTS.SIGNIN_CREDENTIALS_COMPLETE, "info");
        await finalizeAndRedirect();

        return;
      }

      // Invariant #16 — 2FA-enabled accounts must not silently loop back.
      if (signIn.status === "needs_second_factor") {
        logger.event(EVENTS.SIGNIN_NEEDS_2FA, "info");
        const ok = await prepSecondFactor();

        setSubmitting(false);
        if (ok) {
          setCode("");
          setStep("twoFactor");
        }

        return;
      }

      setErrors({ form: "Sign-in didn't finish. Please try again." });
      setSubmitting(false);
    } catch (err) {
      if (isSessionExistsError(err)) {
        continueAsSignedIn();

        return;
      }
      logger.captureError(err, "signin.credentials");
      setErrors({
        form: readClerkError(err, "Couldn't sign you in. Please try again."),
      });
      setSubmitting(false);
    }
  };

  const verifySecondFactor = async (value: string) => {
    switch (secondFactorStrategy) {
      case "email_code":
        return signIn.mfa.verifyEmailCode({ code: value });
      case "phone_code":
        return signIn.mfa.verifyPhoneCode({ code: value });
      case "totp":
        return signIn.mfa.verifyTOTP({ code: value });
      case "backup_code":
        return signIn.mfa.verifyBackupCode({ code: value });
      default:
        return { error: null } as const;
    }
  };

  const onSubmitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;
    if (clerk?.isSignedIn) {
      continueAsSignedIn();

      return;
    }

    const trimmedCode = code.trim();

    if (trimmedCode.length === 0) {
      setErrors({ code: "Enter the code we sent you." });

      return;
    }

    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      if (step === "codeVerify") {
        // First-factor email code path (mode === "code").
        const { error: attemptError } = await signIn.emailCode.verifyCode({
          code: trimmedCode,
        });

        if (attemptError) {
          if (isSessionExistsError(attemptError)) {
            continueAsSignedIn();

            return;
          }
          setErrors({
            code: readClerkError(
              attemptError,
              "That code didn't work. Try again.",
            ),
          });
          setSubmitting(false);

          return;
        }

        if (signIn.status === "complete") {
          logger.event(EVENTS.SIGNIN_CREDENTIALS_COMPLETE, "info", {
            method: "email_code",
          });
          await finalizeAndRedirect();

          return;
        }

        // Even email-code sign-in accounts can have 2FA enabled — Clerk
        // still returns needs_second_factor after the first factor
        // succeeds. Invariant #16 applies here too.
        if (signIn.status === "needs_second_factor") {
          logger.event(EVENTS.SIGNIN_NEEDS_2FA, "info");
          const ok = await prepSecondFactor();

          setSubmitting(false);
          if (ok) {
            setCode("");
            setStep("twoFactor");
          }

          return;
        }

        setErrors({ code: "Verification didn't finish. Try again." });
        setSubmitting(false);

        return;
      }

      // step === "twoFactor"
      const verifyResult = await verifySecondFactor(trimmedCode);
      const attemptError = verifyResult?.error ?? null;

      if (attemptError) {
        if (isSessionExistsError(attemptError)) {
          continueAsSignedIn();

          return;
        }
        setErrors({
          code: readClerkError(
            attemptError,
            "That code didn't work. Try again.",
          ),
        });
        setSubmitting(false);

        return;
      }

      if (signIn.status === "complete") {
        logger.event(EVENTS.SIGNIN_2FA_COMPLETE, "info", {
          strategy: secondFactorStrategy,
        });
        await finalizeAndRedirect();

        return;
      }

      setErrors({ code: "Verification didn't finish. Try again." });
      setSubmitting(false);
    } catch (err) {
      if (isSessionExistsError(err)) {
        continueAsSignedIn();

        return;
      }
      logger.captureError(err, "signin.code_verify", {
        step,
        strategy: secondFactorStrategy,
      });
      setErrors({
        code: readClerkError(err, "That code didn't work. Try again."),
      });
      setSubmitting(false);
    }
  };

  const onResendCode = async () => {
    if (!signIn) return;
    setErrors({});
    setResending(true);

    try {
      if (step === "codeVerify") {
        const sent = await sendEmailCode(email);

        if (sent) {
          setNotice(`A new code was sent to ${maskEmail(email)}.`);
        }

        return;
      }

      // step === "twoFactor"
      if (
        secondFactorStrategy !== "email_code" &&
        secondFactorStrategy !== "phone_code"
      ) {
        // TOTP / backup codes are user-generated — nothing to resend.
        return;
      }

      const { error: sendErr } =
        secondFactorStrategy === "email_code"
          ? await signIn.mfa.sendEmailCode()
          : await signIn.mfa.sendPhoneCode();

      if (sendErr) {
        setErrors({
          form: readClerkError(sendErr, "Couldn't resend the code. Try again."),
        });

        return;
      }

      setNotice(
        secondFactorStrategy === "email_code"
          ? "A new code was sent to your email."
          : "A new code was sent to your phone.",
      );
    } catch (err) {
      setErrors({
        form: readClerkError(err, "Couldn't resend the code. Try again."),
      });
    } finally {
      setResending(false);
    }
  };

  const goBackToCredentials = () => {
    setErrors({});
    setNotice(null);
    setCode("");
    setSecondFactorStrategy(null);
    setStep("credentials");
    try {
      signIn?.reset?.();
    } catch (err) {
      logger.warn?.("signIn.reset failed", err);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setErrors({});
    setNotice(null);
    setPassword("");
  };

  const forgotPasswordHref =
    afterSignInPath !== ROUTES.APP.DASHBOARD
      ? `${ROUTES.AUTH.FORGOT_PASSWORD}?redirect_url=${encodeURIComponent(afterSignInPath)}`
      : ROUTES.AUTH.FORGOT_PASSWORD;

  const signUpHref =
    afterSignInPath !== ROUTES.APP.DASHBOARD
      ? `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(afterSignInPath)}`
      : ROUTES.AUTH.SIGN_UP;

  const isVerifying = step === "codeVerify" || step === "twoFactor";
  // Ref-SS 3 style: "Enter the code to log in" + masked email subtitle.
  // Phone 2FA keeps a generic subtitle since we don't have the number.
  const codeStepTitle = "Enter the code to log in";
  // QA F-29 / F-30 / F-32 / F-33: same wg-notranslate strategy as the
  // signup card. Picking per-locale copy manually keeps every field
  // stable in whatever language the URL prefix declares; Weglot can't
  // re-translate on the password-visibility toggle.
  const pathname = usePathname();
  const isDe = pathname?.split("/")[1] === "de";
  const t = {
    welcomeBack: isDe ? "Willkommen zurück" : "Welcome back",
    logInWithPassword: isDe ? "Mit Passwort anmelden" : "Log in with password",
    continueWithGoogle: isDe ? "Mit Google fortfahren" : "Continue with Google",
    connectingGoogle: isDe ? "Verbindung zu Google…" : "Connecting to Google…",
    or: isDe ? "ODER" : "OR",
    email: isDe ? "E-Mail" : "Email",
    emailPlaceholder: isDe
      ? "Geben Sie Ihre E-Mail-Adresse ein"
      : "Enter Your Email",
    password: isDe ? "Passwort" : "Password",
    passwordPlaceholder: isDe
      ? "Geben Sie Ihr Passwort ein"
      : "Enter Your Password",
    forgotPassword: isDe ? "Passwort vergessen?" : "Forgot password?",
    logIn: isDe ? "Anmelden" : "Log in",
    logInWithEmail: isDe ? "Mit E-Mail anmelden" : "Log in with email",
    signingIn: isDe ? "Anmeldung läuft…" : "Signing in…",
    switchToPassword: isDe
      ? "Stattdessen mit Passwort anmelden"
      : "Log in with password instead",
    switchToCode: isDe
      ? "Stattdessen mit Code anmelden"
      : "Log in with a code instead",
    noAccount: isDe ? "Noch kein Konto?" : "Do not have an account yet?",
    signUp: isDe ? "Registrieren" : "Sign up",
    checkEmail: isDe
      ? `Bitte überprüfen Sie Ihre E-Mail ${maskEmail(email)}.`
      : `Please check your email ${maskEmail(email)}.`,
    checkPhone: isDe
      ? "Wir haben einen 6-stelligen Code an Ihr Telefon gesendet."
      : "We sent a 6-digit code to your phone.",
  };
  const codeStepSubtitle =
    step === "codeVerify"
      ? t.checkEmail
      : secondFactorStrategy === "phone_code"
        ? t.checkPhone
        : t.checkEmail;
  // Ref-SS 1 (initial) shows just "Welcome back" with no subtitle.
  // Ref-SS 2 (password mode) shows "Log in with password".
  const credentialsTitle =
    mode === "password" ? t.logInWithPassword : t.welcomeBack;
  const showResendLink =
    step === "codeVerify" ||
    secondFactorStrategy === "email_code" ||
    secondFactorStrategy === "phone_code";

  return (
    <section
      aria-labelledby={headingId}
      className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-6 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
        id={headingId}
      >
        {isVerifying ? codeStepTitle : credentialsTitle}
      </h1>
      {/* Subtitle only on the verify step per the reference SS (SS3).
          Credentials step (SS1 + SS2) shows the heading alone. */}
      {isVerifying ? (
        <p className="mt-2 text-center text-[14px] leading-5 text-[#666666]">
          {codeStepSubtitle}
        </p>
      ) : null}

      {step === "credentials" ? (
        <>
          <div className="mt-[30px] flex flex-col gap-3">
            <button
              className={OAUTH_BUTTON_CLASS}
              disabled={oauthLoading}
              type="button"
              onClick={onGoogle}
            >
              <GoogleIcon />
              {oauthLoading ? "Connecting to Google…" : "Continue with Google"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <span className="h-px bg-[#d9d9d9]" />
            <span className="text-[16px] text-[#999999]">OR</span>
            <span className="h-px bg-[#d9d9d9]" />
          </div>

          <form
            noValidate
            className="notranslate wg-notranslate mt-6"
            translate="no"
            onSubmit={onSubmitCredentials}
          >
            <label
              className="block text-[14px] text-[#5f5f5f]"
              htmlFor={emailId}
            >
              {t.email}
              <span aria-hidden className="text-[#f12c23]">
                *
              </span>
            </label>
            <input
              required
              aria-describedby={errors.email ? emailErrorId : undefined}
              aria-invalid={errors.email ? true : undefined}
              autoComplete="email"
              className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
              id={emailId}
              inputMode="email"
              name="email"
              placeholder={t.emailPlaceholder}
              spellCheck={false}
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (errors.email) {
                  setErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
            />
            {errors.email ? (
              <p
                className="mt-1.5 text-[13px] text-[#f12c23]"
                id={emailErrorId}
                role="alert"
              >
                {errors.email}
              </p>
            ) : null}

            {mode === "password" ? (
              <>
                <label
                  className="mt-4 block text-[14px] text-[#5f5f5f]"
                  htmlFor={passwordId}
                >
                  {t.password}
                  <span aria-hidden className="text-[#f12c23]">
                    *
                  </span>
                </label>
                <div className="relative mt-2">
                  <input
                    required
                    aria-describedby={
                      errors.password ? passwordErrorId : undefined
                    }
                    aria-invalid={errors.password ? true : undefined}
                    autoComplete="current-password"
                    className="h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 pr-11 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
                    id={passwordId}
                    name="password"
                    placeholder={t.passwordPlaceholder}
                    type={passwordRevealed ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (errors.password) {
                        setErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                  />
                  <PasswordRevealToggle
                    revealed={passwordRevealed}
                    onToggle={() => setPasswordRevealed((v) => !v)}
                  />
                </div>
                {errors.password ? (
                  <p
                    className="mt-1.5 text-[13px] text-[#f12c23]"
                    id={passwordErrorId}
                    role="alert"
                  >
                    {errors.password}
                  </p>
                ) : null}

                {/* Remember me + Forgot password. Only useful in password
                    mode — code mode has no password to forget, and the
                    Clerk session TTL is server-side either way. */}
                <div className="mt-3 flex items-center justify-between text-[13px] text-[#5f5f5f]">
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    htmlFor={rememberMeId}
                  >
                    <input
                      checked={rememberMe}
                      className="size-4 cursor-pointer accent-[#f12c23]"
                      id={rememberMeId}
                      name="rememberMe"
                      type="checkbox"
                      onChange={(event) => setRememberMe(event.target.checked)}
                    />
                    Remember me
                  </label>
                  {onForgotPassword ? (
                    <button
                      className="text-[#5f5f5f] underline-offset-2 hover:text-[#f12c23] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
                      type="button"
                      onClick={onForgotPassword}
                    >
                      {t.forgotPassword}
                    </button>
                  ) : (
                    <Link
                      className="text-[#5f5f5f] underline-offset-2 hover:text-[#f12c23] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
                      href={forgotPasswordHref}
                    >
                      {t.forgotPassword}
                    </Link>
                  )}
                </div>
              </>
            ) : null}

            {errors.form ? (
              <p
                className="mt-3 text-[13px] text-[#f12c23]"
                id={formErrorId}
                role="alert"
              >
                {errors.form}
              </p>
            ) : null}

            {/* Clerk Smart CAPTCHA — memoised anchor so Turnstile
                doesn't 300010 when React re-renders on keystrokes.
                Applies to both `signIn.emailCode.sendCode` (code
                mode) and `signIn.password()` (password mode); Clerk
                only reads the token when its bot-protection config
                requires one. See `TurnstileAnchor` for details. */}
            <TurnstileAnchor />

            <button
              className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? mode === "code"
                  ? "Sending code…"
                  : t.signingIn
                : mode === "code"
                  ? // Ref-SS 1: primary CTA on the code / email-only
                    // step reads "Log in with email".
                    t.logInWithEmail
                  : t.logIn}
            </button>

            {/* Mode toggle. Default is code; user can switch to password
                and back. Kept as a text button, matching the "Forgot
                password?" affordance below. */}
            <button
              className="mt-3 block w-full cursor-pointer text-center text-[14px] text-[#666666] underline underline-offset-2 hover:text-[#1a1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              type="button"
              onClick={() => switchMode(mode === "code" ? "password" : "code")}
            >
              {mode === "code" ? t.switchToPassword : t.switchToCode}
            </button>
          </form>
        </>
      ) : (
        <form
          noValidate
          className="notranslate wg-notranslate mt-8"
          translate="no"
          onSubmit={onSubmitCode}
        >
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#666666] hover:text-[#1a1c21]"
            type="button"
            onClick={goBackToCredentials}
          >
            <BackChevron />
            {step === "codeVerify"
              ? "Use a different email"
              : "Use different credentials"}
          </button>

          <label
            className="block text-center text-[14px] text-[#5f5f5f]"
            htmlFor={codeId}
          >
            Verification code
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <div className="mt-3">
            <OtpBoxes
              ariaDescribedBy={errors.code ? codeErrorId : undefined}
              hasError={Boolean(errors.code)}
              length={6}
              value={code}
              onChange={(next) => {
                setCode(next);
                if (errors.code) {
                  setErrors((prev) => ({ ...prev, code: undefined }));
                }
              }}
            />
          </div>

          {errors.code ? (
            <p
              className="mt-2 text-center text-[13px] text-[#f12c23]"
              id={codeErrorId}
              role="alert"
            >
              {errors.code}
            </p>
          ) : null}
          {errors.form ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={formErrorId}
              role="alert"
            >
              {errors.form}
            </p>
          ) : null}

          <button
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting || code.length === 0}
            type="submit"
          >
            {submitting ? "Verifying…" : "Verify & continue"}
          </button>

          {showResendLink ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 text-[13px] text-[#666666]">
              <p>Didn&apos;t get it?</p>
              <button
                className="cursor-pointer py-1 text-[#f12c23] underline underline-offset-2 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={resending}
                type="button"
                onClick={() => void onResendCode()}
              >
                {resending ? "Sending…" : "Resend code"}
              </button>
            </div>
          ) : null}
        </form>
      )}

      <p aria-live="polite" className="sr-only" id={statusId}>
        {notice}
      </p>
      {notice && isVerifying ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      {step === "credentials" ? (
        <p className="mt-6 text-center text-[15px] text-[#5f5f5f]">
          {t.noAccount}{" "}
          {onSwitchToSignup ? (
            // Modal mode — switch tabs inside the AuthModal instead of
            // navigating to the standalone /sign-up page (which would
            // unmount the modal and lose the pending file / redirectUrl
            // context the caller set up).
            <button
              className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              type="button"
              onClick={onSwitchToSignup}
            >
              {t.signUp}
            </button>
          ) : (
            <Link
              className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              href={signUpHref}
            >
              {t.signUp}
            </Link>
          )}
        </p>
      ) : null}
    </section>
  );
}

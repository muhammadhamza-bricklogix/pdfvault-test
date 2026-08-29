"use client";

import { useClerk, useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { memo, useEffect, useId, useMemo, useRef, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { suppressNextUnload } from "@/lib/client/hooks/pdf-editor/use-editor-navigation-save";
import { ROUTES } from "@/lib/shared/constants/routes";
import { authSignUpSchema } from "@/lib/shared/schemas/auth/sign-up.schema";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

import { GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

/**
 * Stable Turnstile mount point. Memoised so it renders exactly ONCE
 * across the whole SignupCard lifetime — every keystroke in the email
 * field re-renders SignupCard, and Cloudflare Turnstile can't
 * tolerate its container being reconciled during widget init
 * (surfaces as error `300010`: "widget was destroyed while it was in
 * the process of rendering"). React.memo with no props always returns
 * true from its shallow-equality check, so the div is created once
 * and Clerk's SDK owns it thereafter.
 *
 * No `data-cl-size` / `data-cl-theme` attributes: Clerk's Smart
 * CAPTCHA picks the widget mode (invisible → managed challenge as
 * needed) that its managed sitekey is configured for. Explicit
 * `data-cl-size="normal"` requested a visible widget shape the
 * managed sitekey didn't serve on prod, which surfaced as a fresh
 * Turnstile 300010 + `postMessage` origin mismatch and a 400
 * `captcha_invalid` from `POST /v1/client/sign_ups`.
 */
const TurnstileAnchor = memo(function TurnstileAnchor() {
  return <div className="mt-3 flex justify-center" id="clerk-captcha" />;
});

function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
}

/** Extracts the first useful Clerk error message + rewrites the awkward ones. */
function readClerkError(err: unknown, fallback: string): string {
  const first = (
    err as {
      errors?: { longMessage?: string; message?: string; code?: string }[];
    }
  )?.errors?.[0];
  const raw = first?.longMessage ?? first?.message ?? "";

  return humaniseClerkMessage(raw, first?.code) || fallback;
}

function humaniseClerkMessage(raw: string, code?: string): string {
  const s = raw.toLowerCase();

  if (
    code === "form_identifier_exists" ||
    /that email address is taken/i.test(s)
  ) {
    return "This email is already registered. Try signing in instead.";
  }
  if (
    code === "form_code_incorrect" ||
    /code is incorrect|didn.?t work/i.test(s)
  ) {
    return "That code doesn't match. Check your inbox or resend a new one.";
  }
  if (
    code === "strategy_for_user_invalid" ||
    /verification strategy is not valid/i.test(s)
  ) {
    return "Wrong password. Please enter your correct password.";
  }
  if (
    code === "form_identifier_not_found" ||
    /couldn.?t find your account/i.test(s)
  ) {
    return "We couldn't find an account with that email. Create one to get started.";
  }
  if (code === "form_password_required" || /password is required/i.test(s)) {
    return "This workspace requires a password. Toggle 'Sign up with password' and try again.";
  }

  return raw;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Same helper as `login-card.maskEmail` — kept local so the two cards
 * stay independently readable. Masks the local part of an email for
 * the verify-step subtitle ("Please check your email hou***@gmail.com.").
 */
function maskEmailAddress(raw: string): string {
  const at = raw.indexOf("@");

  if (at <= 0) return raw;
  const local = raw.slice(0, at);
  const domain = raw.slice(at);
  const visible = local.slice(0, Math.min(3, local.length));

  return `${visible}***${domain}`;
}

type FieldErrors = {
  email?: string;
  password?: string;
  code?: string;
  form?: string;
};

const INPUT_CLASS =
  "mt-2 h-[52px] w-full rounded-[10px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40";

const LABEL_CLASS = "block text-[14px] leading-[18px] text-[#6f6f6f]";

// Signup mode.
//   - "password" → default (2026-08-28). Email + password:
//                  signUp.password({ ... }) then
//                  verifications.sendEmailCode() + verifyEmailCode().
//                  Required by Clerk instances that mandate a password —
//                  the previous "code" default returned 200 on every
//                  server call but left the sign-up in
//                  `missing_requirements`, so no session was created.
//   - "code"     → passwordless: create({ emailAddress }) then
//                  verifications.sendEmailCode() + verifyEmailCode().
//                  Kept as opt-in for instances configured to allow it.
// Both paths converge on the same "verify" step, so the code UI is shared.
type Mode = "code" | "password";
type Step = "credentials" | "verify";

type SignupCardProps = {
  /**
   * Post-signup destination. When omitted, falls back to
   * `useSearchParams().get('redirect_url')` so the standalone
   * `/sign-up` page keeps working unchanged. AuthModal passes this
   * directly. Finalize nav is still `window.location.assign(…)` per
   * CLAUDE.md invariant #15 — do not swap for `router.push`.
   */
  redirectUrl?: string;
  /**
   * When rendered inside a modal, switches the modal's mode to login
   * instead of navigating to `/sign-in`. When omitted, the "Log In"
   * link falls back to a `<Link>` so the standalone route still works.
   */
  onSwitchToLogin?: () => void;
};

export function SignupCard({
  redirectUrl,
  onSwitchToLogin,
}: SignupCardProps = {}) {
  const { signUp } = useSignUp();
  // `useClerk()` gives us `setActive` for the recovery path (when the
  // SDK loses the session id after its internal `retryImmediately`
  // fires — see `onSubmitCode`) and `clerk.client.reload()` for the
  // belt-and-braces re-sync.
  const clerk = useClerk();
  const setActiveSession = clerk?.setActive;
  const searchParams = useSearchParams();

  // One-shot mount log — pins the environment / clerk / captcha
  // state at the moment the form first appears. Grep DevTools for
  // `[AUTH_DIAG] signup.mount` to see this. If `captchaAnchorMounted`
  // is false here but true at submit time, the anchor was rendered
  // late (past the widget's init deadline) — that maps to Turnstile
  // 300010 territory. If `clerkLoaded` is false, the SDK hadn't
  // finished loading yet.
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] signup.mount", {
      clerkLoaded: Boolean(clerk?.loaded),
      hasSignUp: Boolean(signUp),
      hasSetActive: Boolean(setActiveSession),
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
    // Deliberately empty deps — this fires ONCE per mount so we
    // don't spam the console on every re-render.
  }, []);

  // Default to "password" — the staging Clerk instance requires a password
  // (missing_requirements after verify → no createdSessionId → Path D
  // fallback stranded the user at /sign-in with no account). The
  // passwordless "code" mode stays available via the switch-mode link
  // for instances configured to allow email-only sign-up. QA 2026-08-28.
  const [mode, setMode] = useState<Mode>("password");
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous double-submit guards. `submitting` state is async — a
  // fast double-click (or button-click + Enter-key) both pass the
  // `disabled={submitting}` gate before React re-renders. Refs
  // interlock immediately so the second attempt bails. Without this,
  // `verifyEmailCode` fires twice and the second call returns 400
  // `verification_already_verified` (QA 2026-08-28).
  const submittingCredentialsRef = useRef(false);
  const submittingCodeRef = useRef(false);

  const headingId = useId();
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const passwordHelperId = useId();
  const statusId = useId();

  const afterSignUpPath = useMemo(
    () =>
      safeRedirectPath(
        redirectUrl ?? searchParams.get("redirect_url"),
        ROUTES.APP.DASHBOARD,
      ),
    [redirectUrl, searchParams],
  );

  // Enables/disables the primary CTA. In code mode only the email needs
  // to look valid; in password mode we still run the full schema so the
  // helper text ("min 8, one letter, one digit") stays authoritative.
  const credentialsValid = useMemo(() => {
    const trimmedEmail = email.trim();

    if (mode === "code") {
      return EMAIL_REGEX.test(trimmedEmail);
    }

    return authSignUpSchema.safeParse({
      emailAddress: trimmedEmail,
      password,
    }).success;
  }, [email, password, mode]);

  const onGoogle = async () => {
    if (!signUp) return;
    setErrors({});
    setNotice(null);
    setOauthLoading(true);

    try {
      // Encode the final destination onto BOTH `redirectUrl` (Clerk's
      // stored completion path) AND the `redirectCallbackUrl` query
      // string. Clerk's stored state occasionally gets dropped on the
      // Google → OAuth-provider → Clerk-callback round-trip (cookie /
      // localStorage eviction on some browsers), which then falls the
      // `handleRedirectCallback` to the dashboard fallback and loses
      // the user's editor session. Passing the return URL as a query
      // param on the callback URL itself means our /sso-callback page
      // can read it directly and force the redirect, regardless of
      // whether Clerk still has state.
      const callbackWithReturn = `${ROUTES.AUTH.SSO_CALLBACK}?redirect_url=${encodeURIComponent(afterSignUpPath)}`;

      // Same reason as the credentials `signUp.finalize` path — Google
      // OAuth does a full-page redirect, which trips the editor's
      // `beforeunload` guard when this modal was opened over unsaved
      // edits.
      suppressNextUnload();
      await signUp.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: callbackWithReturn,
        redirectUrl: afterSignUpPath,
      });
    } catch (err) {
      logger.captureError(err, "signup.oauth_google");
      setNotice("Something went wrong with Google sign-up.");
      setOauthLoading(false);
    }
  };

  const onSubmitCredentials = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!signUp) return;
    // Sync double-submit guard — see refs above.
    if (submittingCredentialsRef.current) return;
    submittingCredentialsRef.current = true;

    const trimmedEmail = email.trim();

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setNotice(null);
      setErrors({ email: "Enter a valid email address." });
      submittingCredentialsRef.current = false;

      return;
    }

    if (mode === "password") {
      const parsed = authSignUpSchema.safeParse({
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
        submittingCredentialsRef.current = false;

        return;
      }
    }

    setNotice(null);
    setErrors({});
    setSubmitting(true);
    // eslint-disable-next-line no-console
    console.info("[AUTH_DIAG] signup.credentials.submit", {
      mode,
      hasEmail: Boolean(trimmedEmail),
      hasPassword: mode === "password" ? Boolean(password) : null,
      captchaAnchorMounted: Boolean(
        typeof document !== "undefined" &&
          document.getElementById("clerk-captcha"),
      ),
      clerkOrigin:
        typeof window !== "undefined" ? window.location.origin : "ssr",
    });
    try {
      if (mode === "code") {
        // Passwordless signup: create with just the email address, then
        // send the verification code. If the Clerk instance requires a
        // password on signup, `create` will 422 with form_password_required
        // — humaniseClerkMessage rewrites that to nudge the user to
        // toggle the password mode.
        const { error: createError } = await signUp.create({
          emailAddress: trimmedEmail,
        });

        // eslint-disable-next-line no-console
        console.info("[AUTH_DIAG] signup.create.result", {
          mode: "code",
          hasError: Boolean(createError),
          errorCode: (createError as { errors?: { code?: string }[] })
            ?.errors?.[0]?.code,
          errorMessage: (createError as { errors?: { message?: string }[] })
            ?.errors?.[0]?.message,
          signUpStatus: signUp.status,
          createdSessionId: (signUp as { createdSessionId?: string | null })
            .createdSessionId,
          missingFields: (signUp as { missingFields?: string[] }).missingFields,
        });

        if (createError) {
          const errorCode = (createError as { errors?: { code?: string }[] })
            ?.errors?.[0]?.code;
          const msg = readClerkError(
            createError,
            "Couldn't create your account.",
          );

          if (errorCode === "form_password_required") {
            setErrors({ form: msg });
          } else if (errorCode === "form_identifier_exists") {
            setErrors({ email: msg });
          } else {
            setErrors({ form: msg });
          }

          return;
        }
      } else {
        // Password mode — original flow.
        const { error: passwordError } = await signUp.password({
          emailAddress: trimmedEmail,
          password,
        });

        // eslint-disable-next-line no-console
        console.info("[AUTH_DIAG] signup.create.result", {
          mode: "password",
          hasError: Boolean(passwordError),
          errorCode: (passwordError as { errors?: { code?: string }[] })
            ?.errors?.[0]?.code,
          errorMessage: (passwordError as { errors?: { message?: string }[] })
            ?.errors?.[0]?.message,
          signUpStatus: signUp.status,
          createdSessionId: (signUp as { createdSessionId?: string | null })
            .createdSessionId,
          missingFields: (signUp as { missingFields?: string[] }).missingFields,
        });

        if (passwordError) {
          const errorCode = (passwordError as { errors?: { code?: string }[] })
            ?.errors?.[0]?.code;
          const msg = readClerkError(
            passwordError,
            "Couldn't create your account.",
          );

          if (errorCode === "form_identifier_exists") {
            setErrors({ email: msg });
          } else {
            setErrors({ password: msg });
          }

          return;
        }
      }

      const sendCode = await signUp.verifications.sendEmailCode();

      // eslint-disable-next-line no-console
      console.info("[AUTH_DIAG] signup.send_email_code.result", {
        hasError: Boolean(sendCode.error),
        errorCode: (sendCode.error as { errors?: { code?: string }[] })
          ?.errors?.[0]?.code,
        signUpStatus: signUp.status,
      });

      if (sendCode.error) {
        setErrors({
          form: readClerkError(
            sendCode.error,
            "Couldn't send the verification code.",
          ),
        });

        return;
      }

      setStep("verify");
      setCode("");
      logger.event(EVENTS.SIGNUP_CODE_SENT, "info");
    } catch (err) {
      logger.captureError(err, "signup.credentials");
      setErrors({
        form: readClerkError(
          err,
          "Something went wrong while creating your account.",
        ),
      });
    } finally {
      setSubmitting(false);
      submittingCredentialsRef.current = false;
    }
  };

  const onSubmitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp) return;
    // Sync double-submit interlock — see refs declared above.
    if (submittingCodeRef.current) return;
    submittingCodeRef.current = true;

    const trimmedCode = code.trim();

    if (trimmedCode.length < 4) {
      setErrors({ code: "Enter the code we emailed you." });
      submittingCodeRef.current = false;

      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const { error: verifyError } = await signUp.verifications.verifyEmailCode(
        {
          code: trimmedCode,
        },
      );

      if (verifyError) {
        // Dump the full Clerk error to console. `logger.captureError`
        // alone can serialize `errors[0].code`/`.message` into a
        // string that loses the array structure — for a 400 on
        // `attempt_verification` we need every field: `code`,
        // `message`, `longMessage`, `meta`. Print with the full JSON
        // shape and a distinctive tag so it's grep-friendly in the
        // DevTools filter.
        // eslint-disable-next-line no-console
        console.error(
          "[SIGNUP_VERIFY_400]",
          JSON.stringify(
            {
              errors: (verifyError as { errors?: unknown[] })?.errors,
              status: (verifyError as { status?: number })?.status,
              clerkTraceId: (verifyError as { clerkTraceId?: string })
                ?.clerkTraceId,
              raw: verifyError,
            },
            null,
            2,
          ),
        );

        const errorCode = (verifyError as { errors?: { code?: string }[] })
          ?.errors?.[0]?.code;

        if (errorCode === "verification_already_verified") {
          logger.warn(
            "signup.verify_email_code: already verified — falling through to finalize",
          );
          // Fall through: the signUp is already at status "complete"
          // per Clerk's semantics; the code below will finalize.
        } else {
          logger.captureError(verifyError, "signup.verify_email_code");
          setErrors({
            code: readClerkError(
              verifyError,
              "That code didn't work. Try again or resend a new one.",
            ),
          });

          return;
        }
      }

      // Log the full sign-up state right after verify so a stuck flow
      // (2026-08-28: user reported "stuck at code screen") surfaces
      // WHY. The most common cause is a Clerk dashboard config that
      // requires fields our form doesn't collect (first_name,
      // last_name, phone_number, etc.). `missingFields` +
      // `unverifiedFields` name the exact blocker.
      logger.info("signup.verify_post_state", {
        status: signUp.status,
        missingFields: (signUp as { missingFields?: string[] }).missingFields,
        unverifiedFields: (signUp as { unverifiedFields?: string[] })
          .unverifiedFields,
      });

      // 2026-08-28 real-log evidence: the server returns 200 on all
      // three sign_ups / prepare_verification / attempt_verification
      // requests — the account and session ARE created — but
      // `signUp.finalize` was silently no-op'ing (either
      // `signUp.status` still read stale after the await, or
      // Clerk's navigate callback didn't fire). Rework: skip
      // finalize entirely and drive setActive + full-page nav
      // ourselves whenever we can pin down a `createdSessionId`.
      // That gives us both correctness (session cookie commits
      // before we navigate) AND visibility (each step prints a
      // distinctive log tag so we can see WHERE it stops if it
      // still stalls).
      //
      // Priority ladder:
      //   (A) verify returned 200 AND signUp.createdSessionId is
      //       set → setActive({ session }) + navigate. Most common
      //       happy path.
      //   (B) verify returned "already verified" (SDK retry
      //       artifact — see previous fix) AND we still have a
      //       sessionId locally → same setActive path.
      //   (C) No local sessionId → try `clerk.client.reload()` to
      //       re-sync from the server, re-check `createdSessionId`.
      //   (D) Still nothing → send the user to /sign-in with their
      //       email; the account exists server-side and the pending
      //       file waits in IDB, so post-signin the hydrator
      //       restores it exactly as if they'd signed up cleanly.
      const alreadyVerifiedRecovery = Boolean(
        verifyError &&
          (verifyError as { errors?: { code?: string }[] })?.errors?.[0]
            ?.code === "verification_already_verified",
      );

      const setActiveAndNavigate = async (
        sessionId: string,
        via: string,
      ): Promise<boolean> => {
        try {
          if (!setActiveSession) {
            // eslint-disable-next-line no-console
            console.error("[SIGNUP_FLOW] setActiveSession is null", { via });

            return false;
          }
          // eslint-disable-next-line no-console
          console.info("[SIGNUP_FLOW] setActive → nav", {
            via,
            sessionId,
            afterSignUpPath,
          });
          suppressNextUnload();
          await setActiveSession({ session: sessionId });
          // Manual full-page nav (item #15 iOS Safari cookie commit).
          window.location.assign(afterSignUpPath);

          return true;
        } catch (err) {
          logger.captureError(err, "signup.set_active", { via });

          return false;
        }
      };

      const readSessionId = (): string | null => {
        return (
          (signUp as { createdSessionId?: string | null }).createdSessionId ??
          null
        );
      };

      // eslint-disable-next-line no-console
      console.info("[SIGNUP_FLOW] post_verify_state", {
        verifyStatus: verifyError ? "error" : "ok",
        alreadyVerifiedRecovery,
        signUpStatus: signUp.status,
        createdSessionId: readSessionId(),
        missingFields: (signUp as { missingFields?: string[] }).missingFields,
        unverifiedFields: (signUp as { unverifiedFields?: string[] })
          .unverifiedFields,
      });

      // Path A + B combined — try local sessionId regardless of
      // whether verify was clean or was the retry-artifact recovery.
      const sessionId = readSessionId();

      if (sessionId) {
        if (
          await setActiveAndNavigate(
            sessionId,
            alreadyVerifiedRecovery ? "already_verified_recovery" : "clean",
          )
        ) {
          return;
        }
      }

      // Path C — client re-sync + retry setActive. Fires when the
      // local signUp object doesn't hold the sessionId (SDK's retry
      // dropped it, or the server-side ok response landed but
      // hadn't propagated to the client yet).
      try {
        if (clerk.client) {
          // eslint-disable-next-line no-console
          console.info("[SIGNUP_FLOW] reloading clerk.client");
          await clerk.client.reload();
          const refreshedSessionId = (
            clerk.client.signUp as { createdSessionId?: string | null }
          )?.createdSessionId;

          // eslint-disable-next-line no-console
          console.info("[SIGNUP_FLOW] post_reload", {
            refreshedSessionId,
            refreshedStatus: clerk.client.signUp?.status,
          });

          if (
            refreshedSessionId &&
            (await setActiveAndNavigate(
              refreshedSessionId,
              "post_reload_recovery",
            ))
          ) {
            return;
          }
        }
      } catch (reloadErr) {
        logger.captureError(reloadErr, "signup.client_reload_recovery");
      }

      // Before Path D, check WHY signUp didn't finalize. When the
      // Clerk dashboard requires a field this form didn't collect
      // (most commonly `password`), the sign-up sits in
      // `missing_requirements` — the User row is never created, so a
      // bounce to /sign-in would strand them ("We couldn't find an
      // account with that email"). Recover inside the modal instead:
      // switch back to the credentials step in password mode with the
      // email prefilled and surface a plain-English error naming what
      // Clerk wants. Also flip `signUpNeedsCompletion` so the next
      // submit calls `signUp.update({ password })` instead of
      // `signUp.create(...)` (which would 400 with `form_identifier_exists`
      // against the same email).
      const status = (signUp as { status?: string | null }).status ?? null;
      const missingFields =
        (signUp as { missingFields?: string[] }).missingFields ?? [];

      if (status === "missing_requirements") {
        // eslint-disable-next-line no-console
        console.warn(
          "[SIGNUP_FLOW] missing_requirements — recovering in-modal",
          {
            missingFields,
            email,
          },
        );

        const needsPassword = missingFields.includes("password");
        const message = needsPassword
          ? "Almost there — this account needs a password. Set one and continue."
          : missingFields.length
            ? `To finish signing up, please provide: ${missingFields.join(", ")}.`
            : "We couldn't finish creating your account. Please try again.";

        if (needsPassword) {
          setMode("password");
        }
        setStep("credentials");
        setCode("");
        setErrors({ form: message });

        return;
      }

      // Path D — genuine no-session-id state we don't know how to
      // recover from in-modal. Fall through to /sign-in with the email
      // prefilled; account may or may not exist server-side depending
      // on how the SDK exited, but at least the user has a next step.
      // eslint-disable-next-line no-console
      console.warn(
        "[SIGNUP_FLOW] no session id — routing to /sign-in as fallback",
        { email, afterSignUpPath, status, missingFields },
      );
      suppressNextUnload();
      window.location.assign(
        `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(afterSignUpPath)}&email=${encodeURIComponent(email)}`,
      );
    } catch (err) {
      logger.captureError(err, "signup.verify");
      setErrors({
        code: readClerkError(
          err,
          "That code didn't work. Try again or resend a new one.",
        ),
      });
    } finally {
      setSubmitting(false);
      submittingCodeRef.current = false;
    }
  };

  const onResendCode = async () => {
    if (!signUp) return;
    setErrors({});
    setNotice(null);
    try {
      const { error: resendError } = await signUp.verifications.sendEmailCode();

      if (resendError) {
        setNotice(readClerkError(resendError, "Couldn't resend the code."));

        return;
      }
      setNotice("A fresh code is on the way.");
    } catch (err) {
      logger.captureError(err, "signup.resend");
      setNotice(readClerkError(err, "Couldn't resend the code."));
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setErrors({});
    setNotice(null);
    setPassword("");
  };

  return (
    <section
      aria-labelledby={headingId}
      className="box-border w-[min(447px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-5 pb-6 pt-10 shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:px-8 sm:pb-7 sm:pt-[38px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[29px] text-black"
        id={headingId}
      >
        {step === "credentials"
          ? "Sign up for PDFVault"
          : "Enter the code to sign up"}
      </h1>
      {/* Subtitle only on the verify step per the reference SS.
          Credentials step (SS4) shows the heading alone. */}
      {step === "verify" ? (
        <p className="mt-2.5 text-center text-[14px] leading-5 text-[#666666]">
          {`Please check your email ${maskEmailAddress(email)}.`}
        </p>
      ) : null}

      {step === "credentials" ? (
        <>
          <div className="mt-[34px] flex flex-col gap-[13px]">
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

          <div className="mx-[5px] mt-[30px] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <span className="h-px bg-[#9d9d9d]" />
            <span className="text-[16px] text-[#9d9d9d]">OR</span>
            <span className="h-px bg-[#9d9d9d]" />
          </div>

          <form noValidate className="mt-[30px]" onSubmit={onSubmitCredentials}>
            <div>
              <label className={LABEL_CLASS} htmlFor={emailId}>
                Email
                <span aria-hidden className="text-[#f12c23]">
                  *
                </span>
              </label>
              <input
                required
                aria-invalid={errors.email ? true : undefined}
                autoComplete="email"
                className={INPUT_CLASS}
                id={emailId}
                inputMode="email"
                name="email"
                placeholder="Enter Your Email"
                spellCheck={false}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              {errors.email ? (
                <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
                  {errors.email}
                </p>
              ) : null}
            </div>

            {mode === "password" ? (
              <div className="mt-[8px]">
                <label className={LABEL_CLASS} htmlFor={passwordId}>
                  Password
                  <span aria-hidden className="text-[#f12c23]">
                    *
                  </span>
                </label>
                <div className="relative mt-2">
                  <input
                    required
                    aria-describedby={
                      errors.password ? undefined : passwordHelperId
                    }
                    aria-invalid={errors.password ? true : undefined}
                    autoComplete="new-password"
                    className={`${INPUT_CLASS} mt-0 pr-11`}
                    id={passwordId}
                    name="password"
                    placeholder="Enter Your Password"
                    type={passwordRevealed ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <PasswordRevealToggle
                    revealed={passwordRevealed}
                    onToggle={() => setPasswordRevealed((v) => !v)}
                  />
                </div>
                {errors.password ? (
                  <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
                    {errors.password}
                  </p>
                ) : (
                  <p
                    className="mt-2 text-[13px] text-[#7a7a7a]"
                    id={passwordHelperId}
                  >
                    Password must contain at least 8 characters
                  </p>
                )}
              </div>
            ) : null}

            {errors.form ? (
              <p className="mt-3 text-[13px] text-[#f12c23]" role="alert">
                {errors.form}
              </p>
            ) : null}

            {/* Clerk Smart CAPTCHA — see `TurnstileAnchor` above for
                why this is a memoised component. Rendering it inline
                as `<div id="clerk-captcha" />` caused Turnstile 300010
                errors on production (widget destroyed during render). */}
            <TurnstileAnchor />

            <button
              className="mt-5 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              disabled={submitting || !credentialsValid}
              type="submit"
            >
              {submitting
                ? mode === "code"
                  ? "Sending code…"
                  : "Signing up…"
                : mode === "code"
                  ? "Send verification code"
                  : "Sign up"}
            </button>

            <button
              className="mt-3 block w-full cursor-pointer text-center text-[14px] text-[#666666] underline underline-offset-2 hover:text-[#1a1c21] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
              type="button"
              onClick={() => switchMode(mode === "code" ? "password" : "code")}
            >
              {mode === "code"
                ? "Sign up with password instead"
                : "Sign up with a code instead"}
            </button>
          </form>
        </>
      ) : (
        <form noValidate className="mt-8" onSubmit={onSubmitCode}>
          <label className={LABEL_CLASS} htmlFor={codeId}>
            Verification code
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <input
            autoFocus
            required
            aria-invalid={errors.code ? true : undefined}
            autoComplete="one-time-code"
            className={INPUT_CLASS}
            id={codeId}
            inputMode="numeric"
            name="code"
            placeholder="123456"
            type="text"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
          {errors.code ? (
            <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
              {errors.code}
            </p>
          ) : null}

          <button
            className="mt-4 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Verifying…" : "Verify & Continue"}
          </button>

          <button
            className="mt-3 w-full cursor-pointer text-center text-[13px] text-[#f12c23] underline underline-offset-2 hover:opacity-80"
            type="button"
            onClick={() => void onResendCode()}
          >
            Resend code
          </button>
        </form>
      )}

      <p aria-live="polite" className="sr-only" id={statusId}>
        {notice}
      </p>
      {notice ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      <p className="mt-[28px] text-center text-[16px] text-[#4c4c4c]">
        Already have an account?{" "}
        {onSwitchToLogin ? (
          // Modal mode — switch tabs inside the AuthModal instead of
          // navigating to /sign-in (which would unmount the modal and
          // discard the caller's pending file / redirectUrl context).
          <button
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
            type="button"
            onClick={onSwitchToLogin}
          >
            Log In
          </button>
        ) : (
          <Link
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
            href={
              afterSignUpPath !== ROUTES.APP.DASHBOARD
                ? `${ROUTES.AUTH.SIGN_IN}?redirect_url=${encodeURIComponent(afterSignUpPath)}`
                : ROUTES.AUTH.SIGN_IN
            }
          >
            Log In
          </Link>
        )}
      </p>

      {/* Terms & Privacy — passive statement replaces the previous
          opt-in checkbox. Standard pattern for consumer sign-ups; the
          act of creating an account is the acceptance. Only rendered
          on the credentials step so it doesn't compete with the
          verification-code CTA. */}
      {step === "credentials" ? (
        <p className="mt-4 text-center text-[13px] leading-5 text-[#7a7a7a]">
          By proceeding, you confirm that you have read and agreed to the{" "}
          <Link
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80"
            href={ROUTES.LEGAL.TERMS}
            target="_blank"
          >
            Terms and Conditions
          </Link>{" "}
          and{" "}
          <Link
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80"
            href={ROUTES.LEGAL.PRIVACY}
            target="_blank"
          >
            Privacy Policy
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}

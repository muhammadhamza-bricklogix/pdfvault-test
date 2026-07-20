"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

import { GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
}

function ArrowIcon() {
  return (
    <svg aria-hidden fill="none" height="19" viewBox="0 0 20 20" width="19">
      <path
        d="M4 10h11m0 0-4-4m4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
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

/**
 * Rewrites Clerk's terse / awkward error strings into copy that fits
 * PDFVault's voice. Falls through to the raw message when we don't have
 * a specific rewrite, so newly-added Clerk error codes aren't hidden.
 */
function humaniseClerkMessage(raw: string, code?: string): string {
  const s = raw.toLowerCase();

  if (code === "form_password_pwned" || /pwned/i.test(s)) {
    return "This password appeared in a public data breach. Choose a different one.";
  }
  if (
    code === "form_password_not_strong_enough" ||
    /not strong enough/i.test(s)
  ) {
    return "Password isn't strong enough. Use at least 8 characters with a mix of upper, lower, number, and symbol.";
  }
  if (
    code === "form_identifier_exists" ||
    /that email address is taken/i.test(s)
  ) {
    return "This email is already registered. Try signing in instead.";
  }
  if (
    code === "form_password_incorrect" ||
    code === "strategy_for_user_invalid" ||
    /password is incorrect/i.test(s) ||
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

  return raw;
}

type Step = "email" | "password" | "twoFactor";

// Second-factor strategies we can prompt for. Matches the shape Clerk
// returns in `signIn.supportedSecondFactors[].strategy`.
type SecondFactorStrategy =
  | "email_code"
  | "phone_code"
  | "totp"
  | "backup_code";

export function LoginCard() {
  const { signIn } = useSignIn();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Second-factor state. `strategy` is picked once we detect
  // `needs_second_factor` on the sign-in attempt; `code` holds what the
  // user types in the 6-digit input.
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy | null>(null);
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);

  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const errorId = useId();
  const statusId = useId();

  const afterSignInPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  const onGoogle = async () => {
    if (!signIn) return;
    setError(null);
    setNotice(null);
    setOauthLoading(true);

    try {
      await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: ROUTES.AUTH.SSO_CALLBACK,
        redirectUrl: afterSignInPath,
      });
    } catch (err) {
      logger.error("Google sign-in failed", err);
      setError("Something went wrong with Google sign-in.");
      setOauthLoading(false);
    }
  };

  const onSubmitEmail = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();

    setNotice(null);
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");

      return;
    }
    setError(null);
    setEmail(value);
    setStep("password");
  };

  const onSubmitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;
    if (password.length === 0) {
      setError("Enter your password to continue.");

      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const { error: submitError } = await signIn.password({
        emailAddress: email,
        password,
      });

      if (submitError) {
        setError(
          readClerkError(
            submitError,
            "Couldn't sign you in. Please try again.",
          ),
        );
        setSubmitting(false);

        return;
      }

      if (signIn.status === "complete") {
        const { error: finalizeError } = await signIn.finalize({
          navigate: ({ decorateUrl }) => {
            // Full-page navigation (not `router.push`). Clerk sets the
            // session cookie during finalize; on mobile Safari the SPA
            // transition can outrun the cookie commit, so the middleware
            // sees the user as signed-out and bounces them to /sign-up.
            // `window.location.assign` forces a fresh document request
            // that always includes the freshly-set cookie.
            window.location.assign(decorateUrl(afterSignInPath));
          },
        });

        if (finalizeError) {
          setError(
            readClerkError(finalizeError, "Couldn't finish signing you in."),
          );
          setSubmitting(false);
        }

        return;
      }

      // Account has 2FA enabled → password verified, now prompt for the
      // second-factor code. We prefer email_code because that's what our
      // Clerk instance defaults to, but fall back to whatever the account
      // supports.
      if (signIn.status === "needs_second_factor") {
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
          setError(
            "Two-factor authentication is required but no method is available. Contact support.",
          );
          setSubmitting(false);

          return;
        }

        setSecondFactorStrategy(preferred.strategy);

        // TOTP + backup codes are user-typed — no prep call needed. For
        // email_code / phone_code we ask Clerk to send the code now via
        // the `mfa` namespace of the Future-API sign-in resource.
        if (preferred.strategy === "email_code") {
          const { error: sendErr } = await signIn.mfa.sendEmailCode();

          if (sendErr) {
            setError(
              readClerkError(
                sendErr,
                "Couldn't send your verification code. Try again.",
              ),
            );
            setSubmitting(false);

            return;
          }
          setNotice("We sent a 6-digit code to your email.");
        } else if (preferred.strategy === "phone_code") {
          const { error: sendErr } = await signIn.mfa.sendPhoneCode();

          if (sendErr) {
            setError(
              readClerkError(
                sendErr,
                "Couldn't send your verification code. Try again.",
              ),
            );
            setSubmitting(false);

            return;
          }
          setNotice("We sent a 6-digit code to your phone.");
        }

        setStep("twoFactor");
        setSubmitting(false);

        return;
      }

      // Some other unexpected status — fall through to SSO callback so
      // Clerk's own recovery UI can pick up the pieces.
      router.push(ROUTES.AUTH.SSO_CALLBACK);
    } catch (err) {
      logger.error("Password sign-in failed", err);
      setError(readClerkError(err, "Couldn't sign you in. Please try again."));
      setSubmitting(false);
    }
  };

  const onSubmitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;
    if (!secondFactorStrategy) return;

    const trimmedCode = code.trim();

    if (trimmedCode.length === 0) {
      setError("Enter the code we sent you.");

      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const verify = async () => {
        switch (secondFactorStrategy) {
          case "email_code":
            return signIn.mfa.verifyEmailCode({ code: trimmedCode });
          case "phone_code":
            return signIn.mfa.verifyPhoneCode({ code: trimmedCode });
          case "totp":
            return signIn.mfa.verifyTOTP({ code: trimmedCode });
          case "backup_code":
            return signIn.mfa.verifyBackupCode({ code: trimmedCode });
        }
      };
      const { error: attemptError } = (await verify()) ?? {};

      if (attemptError) {
        setError(
          readClerkError(attemptError, "That code didn't work. Try again."),
        );
        setSubmitting(false);

        return;
      }

      if (signIn.status !== "complete") {
        setError("Verification didn't finish. Try again.");
        setSubmitting(false);

        return;
      }

      const { error: finalizeError } = await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          window.location.assign(decorateUrl(afterSignInPath));
        },
      });

      if (finalizeError) {
        setError(
          readClerkError(finalizeError, "Couldn't finish signing you in."),
        );
        setSubmitting(false);
      }
    } catch (err) {
      logger.error("2FA verification failed", err);
      setError(readClerkError(err, "That code didn't work. Try again."));
      setSubmitting(false);
    }
  };

  const onResendCode = async () => {
    if (!signIn || !secondFactorStrategy) return;
    if (
      secondFactorStrategy !== "email_code" &&
      secondFactorStrategy !== "phone_code"
    ) {
      return;
    }

    setError(null);
    setResending(true);

    try {
      const { error: sendErr } =
        secondFactorStrategy === "email_code"
          ? await signIn.mfa.sendEmailCode()
          : await signIn.mfa.sendPhoneCode();

      if (sendErr) {
        setError(
          readClerkError(sendErr, "Couldn't resend the code. Try again."),
        );

        return;
      }

      setNotice(
        secondFactorStrategy === "email_code"
          ? "A new code was sent to your email."
          : "A new code was sent to your phone.",
      );
    } catch (err) {
      setError(readClerkError(err, "Couldn't resend the code. Try again."));
    } finally {
      setResending(false);
    }
  };

  const goBackToPassword = () => {
    setError(null);
    setNotice(null);
    setCode("");
    setSecondFactorStrategy(null);
    setStep("password");
  };

  const goBackToEmail = () => {
    setError(null);
    setNotice(null);
    setPassword("");
    setStep("email");
  };

  return (
    <section
      aria-labelledby={`${emailId}-title`}
      className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-9 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:min-h-[562px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
        id={`${emailId}-title`}
      >
        Login to PDFVault
      </h1>
      <p className="mt-2 text-center text-[14px] leading-5 text-[#666666]">
        {step === "email"
          ? "Please enter your details below to sign in"
          : step === "password"
            ? `Signing in as ${email}`
            : "Enter the verification code we sent you"}
      </p>

      {/* OAuth providers — email step only */}
      {step === "email" ? (
        <>
          <div className="mt-[30px] flex flex-col gap-3">
            <button
              className={OAUTH_BUTTON_CLASS}
              disabled={oauthLoading}
              type="button"
              onClick={onGoogle}
            >
              <GoogleIcon />
              {oauthLoading ? "Connecting to Google…" : "Login with Google"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <span className="h-px bg-[#d9d9d9]" />
            <span className="text-[16px] text-[#999999]">
              Or sign in with email
            </span>
            <span className="h-px bg-[#d9d9d9]" />
          </div>

          <form noValidate className="mt-6" onSubmit={onSubmitEmail}>
            <label
              className="block text-[14px] text-[#5f5f5f]"
              htmlFor={emailId}
            >
              Your Registered Email
              <span aria-hidden className="text-[#f12c23]">
                *
              </span>
            </label>
            <input
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="email"
              className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
              id={emailId}
              inputMode="email"
              name="email"
              placeholder="john.doe@gmail.com"
              spellCheck={false}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            {error ? (
              <p
                className="mt-2 text-[13px] text-[#f12c23]"
                id={errorId}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              type="submit"
            >
              Continue
              <ArrowIcon />
            </button>
          </form>
        </>
      ) : step === "password" ? (
        <form noValidate className="mt-8" onSubmit={onSubmitPassword}>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#666666] hover:text-[#1a1c21]"
            type="button"
            onClick={goBackToEmail}
          >
            <BackChevron />
            Use a different email
          </button>

          <label
            className="block text-[14px] text-[#5f5f5f]"
            htmlFor={passwordId}
          >
            Password
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <div className="relative mt-2">
            <input
              autoFocus
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="current-password"
              className="h-[52px] w-full rounded-[12px] bg-[#f7f7f7] pl-3 pr-11 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
              id={passwordId}
              name="password"
              placeholder="••••••••"
              type={passwordRevealed ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <PasswordRevealToggle
              revealed={passwordRevealed}
              onToggle={() => setPasswordRevealed((v) => !v)}
            />
          </div>

          {error ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={errorId}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Signing in…" : "Sign In"}
            {submitting ? null : <ArrowIcon />}
          </button>
        </form>
      ) : (
        <form noValidate className="mt-8" onSubmit={onSubmitCode}>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#666666] hover:text-[#1a1c21]"
            type="button"
            onClick={goBackToPassword}
          >
            <BackChevron />
            Back to password
          </button>

          <label className="block text-[14px] text-[#5f5f5f]" htmlFor={codeId}>
            Verification code
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <input
            autoFocus
            required
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="one-time-code"
            className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-center text-[20px] font-semibold tracking-[0.4em] text-[#1a1c21] outline-none placeholder:text-[#c4c4c4] placeholder:tracking-normal placeholder:font-normal placeholder:text-[16px] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
            id={codeId}
            inputMode="numeric"
            maxLength={8}
            name="code"
            pattern="[0-9]*"
            placeholder="123456"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/[^0-9]/g, ""))
            }
          />

          {error ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={errorId}
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting || code.length === 0}
            type="submit"
          >
            {submitting ? "Verifying…" : "Verify"}
            {submitting ? null : <ArrowIcon />}
          </button>

          {secondFactorStrategy === "email_code" ||
          secondFactorStrategy === "phone_code" ? (
            <button
              className="mt-3 block w-full text-center text-[13px] text-[#666666] hover:text-[#1a1c21] disabled:opacity-60"
              disabled={resending}
              type="button"
              onClick={() => void onResendCode()}
            >
              {resending ? "Sending…" : "Didn't get it? Resend code"}
            </button>
          ) : null}
        </form>
      )}

      <p aria-live="polite" className="sr-only" id={statusId}>
        {notice}
      </p>
      {notice ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      <p className="mt-6 text-center text-[16px] text-[#5f5f5f]">
        Don’t have an account yet?{" "}
        <Link
          className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
          href={ROUTES.AUTH.SIGN_UP}
        >
          Sign Up
        </Link>
      </p>
    </section>
  );
}

"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";
import {
  evaluatePassword,
  PASSWORD_RULES,
} from "@/lib/shared/utils/password-strength";
import { logger } from "@/lib/shared/utils/logger";

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
 * Extracts the first useful Clerk error message with our voice-tuned
 * rewrites. Same helper shape as LoginCard/SignupCard so error copy
 * stays consistent across the auth flow.
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

function humaniseClerkMessage(raw: string, code?: string): string {
  const s = raw.toLowerCase();

  if (
    code === "form_identifier_not_found" ||
    /couldn.?t find your account/i.test(s)
  ) {
    return "We couldn't find an account with that email. Create one to get started.";
  }
  if (
    code === "form_code_incorrect" ||
    /code is incorrect|didn.?t work/i.test(s)
  ) {
    return "That code doesn't match. Check your inbox or resend a new one.";
  }
  if (code === "form_password_pwned" || /pwned/i.test(s)) {
    return "This password appeared in a public data breach. Choose a different one.";
  }
  if (
    code === "form_password_not_strong_enough" ||
    /not strong enough/i.test(s)
  ) {
    return "Password isn't strong enough. Use at least 8 characters with a mix of upper, lower, number, and symbol.";
  }

  return raw;
}

type Step = "request" | "reset";

/**
 * Password-reset flow, wired to Clerk's
 * `reset_password_email_code` strategy.
 *
 *   Step 1 — user enters their email; we call
 *            `signIn.create({ strategy: "reset_password_email_code" })`,
 *            which triggers Clerk to email a 6-digit code.
 *   Step 2 — user enters the code + a new password; we call
 *            `signIn.attemptFirstFactor(...)` to verify + set. On
 *            `status === "complete"` we finalize the session via a
 *            full-page navigation, matching LoginCard's mobile-Safari
 *            cookie-commit workaround.
 *
 * Copy + shape mirror LoginCard / SignupCard so the visual language of
 * the auth surfaces stays consistent.
 */
export function ForgotPasswordCard() {
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const emailId = useId();
  const codeId = useId();
  const passwordId = useId();
  const errorId = useId();
  const statusId = useId();

  const afterResetPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  const sendResetCode = async (address: string) => {
    if (!signIn) return false;
    try {
      // Future API sequence: `create({ identifier })` opens the sign-in
      // attempt against that email so subsequent reset methods know
      // which account to target. `resetPasswordEmailCode.sendCode()`
      // then emails the 6-digit code to the account's primary email.
      const { error: createError } = await signIn.create({
        identifier: address,
      });

      if (createError) {
        setError(
          readClerkError(
            createError,
            "Couldn't send a reset code. Check the email and try again.",
          ),
        );

        return false;
      }

      const { error: sendError } =
        await signIn.resetPasswordEmailCode.sendCode();

      if (sendError) {
        setError(
          readClerkError(
            sendError,
            "Couldn't send a reset code. Check the email and try again.",
          ),
        );

        return false;
      }

      return true;
    } catch (err) {
      logger.error("password reset request failed", err);
      setError(
        readClerkError(
          err,
          "Couldn't send a reset code. Check the email and try again.",
        ),
      );

      return false;
    }
  };

  const onSubmitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;

    const value = email.trim();

    setNotice(null);
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");

      return;
    }

    setError(null);
    setEmail(value);
    setSubmitting(true);

    const ok = await sendResetCode(value);

    setSubmitting(false);

    if (!ok) return;

    setNotice(`We sent a 6-digit code to ${value}.`);
    setStep("reset");
  };

  const onSubmitReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;

    const trimmedCode = code.trim();

    if (trimmedCode.length < 4) {
      setError("Enter the code we emailed you.");

      return;
    }

    const strength = evaluatePassword(password);

    if (!strength.allPassed) {
      setError(
        "Password must be at least 8 characters and include upper, lower, number, and a symbol.",
      );

      return;
    }

    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      // Verify the email code — Clerk moves `signIn.status` to
      // `'needs_new_password'` on success.
      const { error: verifyError } =
        await signIn.resetPasswordEmailCode.verifyCode({
          code: trimmedCode,
        });

      if (verifyError) {
        setError(
          readClerkError(
            verifyError,
            "That code didn't work. Check your inbox or resend a new one.",
          ),
        );
        setSubmitting(false);

        return;
      }

      // Submit the new password — Clerk moves `signIn.status` to
      // `'complete'` on success.
      const { error: submitError } =
        await signIn.resetPasswordEmailCode.submitPassword({
          password,
        });

      if (submitError) {
        setError(
          readClerkError(submitError, "Couldn't set your new password."),
        );
        setSubmitting(false);

        return;
      }

      if (signIn.status !== "complete") {
        setError(
          "One more step is needed to finish the reset. Please try again in a moment.",
        );
        setSubmitting(false);

        return;
      }

      const { error: finalizeError } = await signIn.finalize({
        navigate: ({ decorateUrl }) => {
          // Full-page navigation matches LoginCard's Clerk-cookie
          // commit workaround for mobile Safari.
          window.location.assign(decorateUrl(afterResetPath));
        },
      });

      if (finalizeError) {
        setError(
          readClerkError(finalizeError, "Couldn't finish signing you in."),
        );
        setSubmitting(false);
      }
    } catch (err) {
      logger.error("password reset submit failed", err);
      setError(readClerkError(err, "Couldn't reset your password. Try again."));
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!signIn) return;
    setError(null);
    setNotice(null);
    setResending(true);
    const ok = await sendResetCode(email);

    setResending(false);
    if (ok) setNotice("A fresh code is on the way.");
  };

  const goBackToEmail = () => {
    setError(null);
    setNotice(null);
    setCode("");
    setPassword("");
    setStep("request");
  };

  return (
    <section
      aria-labelledby={`${emailId}-title`}
      className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-9 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:min-h-[520px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
        id={`${emailId}-title`}
      >
        Forgot your password?
      </h1>
      <p className="mt-2 text-center text-[14px] leading-5 text-[#666666]">
        {step === "request"
          ? "Enter your email and we'll send you a code to reset it."
          : `Enter the code we sent to ${email} and choose a new password.`}
      </p>

      {step === "request" ? (
        <form noValidate className="mt-8" onSubmit={onSubmitEmail}>
          <label className="block text-[14px] text-[#5f5f5f]" htmlFor={emailId}>
            Email
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <input
            autoFocus
            required
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            autoComplete="email"
            className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
            id={emailId}
            inputMode="email"
            name="email"
            placeholder="Enter Your Email"
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
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Sending…" : "Send reset code"}
            {submitting ? null : <ArrowIcon />}
          </button>
        </form>
      ) : (
        <form noValidate className="mt-8" onSubmit={onSubmitReset}>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#666666] hover:text-[#1a1c21]"
            type="button"
            onClick={goBackToEmail}
          >
            <BackChevron />
            Use a different email
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
            className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-center text-[20px] font-semibold tracking-[0.4em] text-[#1a1c21] outline-none placeholder:text-[16px] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#c4c4c4] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
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

          <label
            className="mt-4 block text-[14px] text-[#5f5f5f]"
            htmlFor={passwordId}
          >
            New password
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <div className="relative mt-2">
            <input
              required
              aria-describedby={error ? errorId : undefined}
              aria-invalid={error ? true : undefined}
              autoComplete="new-password"
              className="h-[52px] w-full rounded-[12px] bg-[#f7f7f7] pl-3 pr-11 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
              id={passwordId}
              minLength={8}
              name="password"
              placeholder="Enter Your New Password"
              type={passwordRevealed ? "text" : "password"}
              value={password}
              onBlur={() => setPasswordFocused(false)}
              onChange={(event) => setPassword(event.target.value)}
              onFocus={() => setPasswordFocused(true)}
            />
            <PasswordRevealToggle
              revealed={passwordRevealed}
              onToggle={() => setPasswordRevealed((v) => !v)}
            />
          </div>

          {passwordFocused || password.length > 0 ? (
            <ul
              aria-label="Password requirements"
              className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2"
            >
              {PASSWORD_RULES.map((rule) => {
                const passed = rule.test(password);

                return (
                  <li
                    key={rule.key}
                    className={`flex items-center gap-1.5 text-[12px] ${
                      passed ? "text-[#0a9e5a]" : "text-[#8a8a8a]"
                    }`}
                  >
                    <span aria-hidden>{passed ? "✓" : "○"}</span>
                    <span>{rule.label}</span>
                  </li>
                );
              })}
            </ul>
          ) : null}

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
            disabled={submitting || code.length === 0 || password.length === 0}
            type="submit"
          >
            {submitting ? "Resetting…" : "Reset password"}
            {submitting ? null : <ArrowIcon />}
          </button>

          <button
            className="mt-3 block w-full text-center text-[13px] text-[#666666] hover:text-[#1a1c21] disabled:opacity-60"
            disabled={resending}
            type="button"
            onClick={() => void onResend()}
          >
            {resending ? "Sending…" : "Didn't get it? Resend code"}
          </button>
        </form>
      )}

      <p aria-live="polite" className="sr-only" id={statusId}>
        {notice}
      </p>
      {notice ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      <p className="mt-6 text-center text-[16px] text-[#5f5f5f]">
        Remembered it?{" "}
        <Link
          className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
          href={ROUTES.AUTH.SIGN_IN}
        >
          Log In
        </Link>
      </p>
    </section>
  );
}

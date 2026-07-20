"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";
import {
  evaluatePassword,
  PASSWORD_RULES,
} from "@/lib/shared/utils/password-strength";

import { GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  return raw;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");

  return { firstName, lastName };
}

type FieldErrors = {
  email?: string;
  fullName?: string;
  password?: string;
  code?: string;
};

const INPUT_CLASS =
  "mt-2 h-[52px] w-full rounded-[10px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40";

const LABEL_CLASS = "block text-[14px] leading-[18px] text-[#6f6f6f]";

type Step = "credentials" | "verify";

export function SignupCard() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("credentials");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const headingId = useId();
  const fullNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const codeId = useId();
  const statusId = useId();

  const afterSignUpPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  const onGoogle = async () => {
    if (!signUp) return;
    setErrors({});
    setNotice(null);
    setOauthLoading(true);

    try {
      await signUp.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: ROUTES.AUTH.SSO_CALLBACK,
        redirectUrl: afterSignUpPath,
      });
    } catch (err) {
      logger.error("Google sign-up failed", err);
      setNotice("Something went wrong with Google sign-up.");
      setOauthLoading(false);
    }
  };

  const onSubmitCredentials = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!signUp) return;

    const nextErrors: FieldErrors = {};
    const trimmedEmail = email.trim();

    if (!fullName.trim()) {
      nextErrors.fullName = "Please enter your full name.";
    }
    if (!EMAIL_RE.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    const strength = evaluatePassword(password);

    if (!strength.allPassed) {
      nextErrors.password =
        "Password must be at least 8 characters and include upper, lower, number, and a symbol.";
    }

    setNotice(null);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      const { firstName, lastName } = splitName(fullName);

      // Future-API Clerk sign-up: create the attempt, attach the name
      // (best-effort — some Clerk instances reject unknown fields, in which
      // case we still ship the account and let the user set names later
      // from Settings), then send the email verification code.
      const { error: passwordError } = await signUp.password({
        emailAddress: trimmedEmail,
        password,
      });

      if (passwordError) {
        setErrors({
          password: readClerkError(
            passwordError,
            "Couldn't create your account.",
          ),
        });

        return;
      }

      if (firstName || lastName) {
        try {
          await signUp.update({ firstName, lastName });
        } catch (nameErr) {
          logger.warn?.("Signup name update failed (non-fatal)", nameErr);
        }
      }

      const sendCode = await signUp.verifications.sendEmailCode();

      if (sendCode.error) {
        setErrors({
          password: readClerkError(
            sendCode.error,
            "Couldn't send the verification code.",
          ),
        });

        return;
      }

      setStep("verify");
      setCode("");
    } catch (err) {
      logger.error("Sign-up submission failed", err);
      setErrors({
        password: readClerkError(
          err,
          "Something went wrong while creating your account.",
        ),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signUp) return;
    const trimmedCode = code.trim();

    if (trimmedCode.length < 4) {
      setErrors({ code: "Enter the code we emailed you." });

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
        setErrors({
          code: readClerkError(
            verifyError,
            "That code didn't work. Try again or resend a new one.",
          ),
        });

        return;
      }

      if (signUp.status === "complete") {
        const { error: finalizeError } = await signUp.finalize({
          navigate: ({ decorateUrl }) => {
            // Full-page navigation so the freshly-set Clerk session cookie
            // is on the next request. `router.push` runs in-tab before
            // mobile Safari commits the cookie, which makes the middleware
            // treat the user as signed-out and bounce them to /sign-up.
            window.location.assign(decorateUrl(afterSignUpPath));
          },
        });

        if (finalizeError) {
          setErrors({
            code: readClerkError(
              finalizeError,
              "Couldn't finish creating your account.",
            ),
          });
        }

        return;
      }

      setNotice(
        "One more step is needed to finish creating your account. Please check your email.",
      );
    } catch (err) {
      logger.error("Verification failed", err);
      setErrors({
        code: readClerkError(
          err,
          "That code didn't work. Try again or resend a new one.",
        ),
      });
    } finally {
      setSubmitting(false);
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
      logger.error("Resend failed", err);
      setNotice(readClerkError(err, "Couldn't resend the code."));
    }
  };

  return (
    <section
      aria-labelledby={headingId}
      className="box-border w-[min(447px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-5 pb-8 pt-10 shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:min-h-[735px] sm:px-8 sm:pb-[44px] sm:pt-[38px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[29px] text-black"
        id={headingId}
      >
        {step === "credentials" ? "Create a Free Account" : "Verify your email"}
      </h1>
      <p className="mt-2.5 text-center text-[14px] leading-5 text-[#666666]">
        {step === "credentials"
          ? "Please enter your details below to create your account"
          : `We sent a code to ${email}.`}
      </p>

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
            <span className="text-[16px] text-[#9d9d9d]">
              Or sign in with email
            </span>
            <span className="h-px bg-[#9d9d9d]" />
          </div>

          <form noValidate className="mt-[30px]" onSubmit={onSubmitCredentials}>
            <div>
              <label className={LABEL_CLASS} htmlFor={fullNameId}>
                Your Fullname
                <span aria-hidden className="text-[#f12c23]">
                  *
                </span>
              </label>
              <input
                required
                aria-invalid={errors.fullName ? true : undefined}
                autoComplete="name"
                className={INPUT_CLASS}
                id={fullNameId}
                name="fullName"
                placeholder="John Doe"
                spellCheck={false}
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
              {errors.fullName ? (
                <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
                  {errors.fullName}
                </p>
              ) : null}
            </div>

            <div className="mt-[8px]">
              <label className={LABEL_CLASS} htmlFor={emailId}>
                Your Registered Email
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
                placeholder="john.doe@gmail.com"
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

            <div className="mt-[8px]">
              <label className={LABEL_CLASS} htmlFor={passwordId}>
                Your Password
                <span aria-hidden className="text-[#f12c23]">
                  *
                </span>
              </label>
              <div className="relative mt-2">
                <input
                  required
                  aria-invalid={errors.password ? true : undefined}
                  autoComplete="new-password"
                  className={`${INPUT_CLASS} mt-0 pr-11`}
                  id={passwordId}
                  minLength={8}
                  name="password"
                  placeholder="********"
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
              {errors.password ? (
                <p className="mt-2 text-[13px] text-[#f12c23]" role="alert">
                  {errors.password}
                </p>
              ) : null}
              {(passwordFocused || password.length > 0) && !errors.password ? (
                <ul
                  aria-label="Password requirements"
                  className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2"
                >
                  {PASSWORD_RULES.map((rule) => {
                    const passed = rule.test(password);

                    return (
                      <li
                        key={rule.key}
                        className={`flex items-center gap-1.5 text-[12px] ${passed ? "text-[#0a9e5a]" : "text-[#8a8a8a]"}`}
                      >
                        <span aria-hidden>{passed ? "✓" : "○"}</span>
                        <span>{rule.label}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>

            <button
              className="mt-4 flex h-[56px] w-full cursor-pointer items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Creating account…" : "Create Account"}
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
        <Link
          className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
          href={ROUTES.AUTH.SIGN_IN}
        >
          Sign In
        </Link>
      </p>
    </section>
  );
}

"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

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
    code === "form_identifier_not_found" ||
    /couldn.?t find your account/i.test(s)
  ) {
    return "We couldn't find an account with that email. Create one to get started.";
  }

  return raw;
}

// PRD §3 — password path is retired. Flow is now:
//   1. "email"     → user enters address, we call signIn.create() +
//                    signIn.emailCode.sendCode()
//   2. "code"      → user enters the 6-digit first-factor OTP; success
//                    either finalizes (status "complete") or advances to
//                    "twoFactor" if the account still has a 2FA layer.
//   3. "twoFactor" → preserved 2FA path (email/phone/TOTP/backup). Invariant
//                    #16 lives here; do not delete without a 2FA-account
//                    test pass.
type Step = "email" | "code" | "twoFactor";

type FieldErrors = {
  email?: string;
  code?: string;
  form?: string;
};

type SecondFactorStrategy =
  | "email_code"
  | "phone_code"
  | "totp"
  | "backup_code";

export function LoginCard() {
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Second-factor state. `strategy` is picked once we detect
  // `needs_second_factor`; `code` is shared with the first-factor step.
  const [secondFactorStrategy, setSecondFactorStrategy] =
    useState<SecondFactorStrategy | null>(null);

  const emailId = useId();
  const codeId = useId();
  const emailErrorId = useId();
  const codeErrorId = useId();
  const formErrorId = useId();
  const statusId = useId();

  const afterSignInPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  // Post-verify navigation. Invariant #15: iOS Safari commits the Clerk
  // session cookie during a full-page navigation; router.push outruns the
  // commit and lands on middleware that reads the user as signed-out,
  // bouncing them to /sign-up. window.location.assign is required.
  const finalizeAndRedirect = async () => {
    const { error: finalizeError } = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        window.location.assign(decorateUrl(afterSignInPath));
      },
    });

    if (finalizeError) {
      setErrors({
        form: readClerkError(finalizeError, "Couldn't finish signing you in."),
      });
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (!signIn) return;
    setErrors({});
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
      setErrors({ form: "Something went wrong with Google sign-in." });
      setOauthLoading(false);
    }
  };

  const onSubmitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;

    const value = email.trim();
    const nextErrors: FieldErrors = {};

    if (value.length === 0) {
      nextErrors.email = "Enter your email address.";
    } else if (!EMAIL_RE.test(value)) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (nextErrors.email) {
      setErrors(nextErrors);

      return;
    }

    setEmail(value);
    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      const { error: createError } = await signIn.create({ identifier: value });

      if (createError) {
        setErrors({
          form: readClerkError(
            createError,
            "Couldn't start sign-in. Please try again.",
          ),
        });
        setSubmitting(false);

        return;
      }

      const { error: sendError } = await signIn.emailCode.sendCode();

      if (sendError) {
        setErrors({
          form: readClerkError(
            sendError,
            "Couldn't send your verification code. Try again.",
          ),
        });
        setSubmitting(false);

        return;
      }

      setNotice("We sent a 6-digit code to your email.");
      setCode("");
      setStep("code");
    } catch (err) {
      logger.error("Sign-in email step failed", err);
      setErrors({
        form: readClerkError(err, "Couldn't sign you in. Please try again."),
      });
    } finally {
      setSubmitting(false);
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

  const onSubmitCode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!signIn) return;

    const trimmedCode = code.trim();

    if (trimmedCode.length === 0) {
      setErrors({ code: "Enter the code we sent you." });

      return;
    }

    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      // Two paths through this handler:
      // - step === "code" → first-factor email OTP (the new PRD path)
      // - step === "twoFactor" → account has 2FA on top of first-factor
      const verifyResult = await (step === "twoFactor"
        ? verifySecondFactor(trimmedCode)
        : signIn.emailCode.verifyCode({ code: trimmedCode }));
      const attemptError = verifyResult?.error ?? null;

      if (attemptError) {
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
        await finalizeAndRedirect();

        return;
      }

      // First-factor code accepted but account still has a 2FA layer.
      // Invariant #16 — 2FA-enabled accounts must not silently loop back.
      if (step === "code" && signIn.status === "needs_second_factor") {
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
    } catch (err) {
      logger.error("Verification failed", err);
      setErrors({
        code: readClerkError(err, "That code didn't work. Try again."),
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

  const onResendCode = async () => {
    if (!signIn) return;
    setErrors({});
    setResending(true);

    try {
      if (step === "code") {
        const { error: sendErr } = await signIn.emailCode.sendCode();

        if (sendErr) {
          setErrors({
            form: readClerkError(
              sendErr,
              "Couldn't resend the code. Try again.",
            ),
          });

          return;
        }
        setNotice("A new code was sent to your email.");

        return;
      }

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

  const goBackToEmail = () => {
    setErrors({});
    setNotice(null);
    setCode("");
    setSecondFactorStrategy(null);
    setStep("email");
    // Reset the underlying Clerk sign-in so a fresh identifier can be
    // submitted without hitting "sign-in already exists" state.
    try {
      signIn?.reset?.();
    } catch (err) {
      logger.warn?.("signIn.reset failed", err);
    }
  };

  const isCodeStep = step === "code" || step === "twoFactor";

  const codeSubtitle =
    step === "twoFactor"
      ? "Enter your two-factor authentication code"
      : `We sent a 6-digit code to ${email}.`;

  const canResendInline =
    step === "code" ||
    secondFactorStrategy === "email_code" ||
    secondFactorStrategy === "phone_code";

  return (
    <section
      aria-labelledby={`${emailId}-title`}
      className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-9 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:min-h-[562px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
        id={`${emailId}-title`}
      >
        {isCodeStep ? "Check your email" : "Welcome back to PDF Vault"}
      </h1>
      {isCodeStep ? (
        <p className="mt-2 text-center text-[14px] leading-5 text-[#666666]">
          {codeSubtitle}
        </p>
      ) : null}

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
              {oauthLoading ? "Connecting to Google…" : "Continue with Google"}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
            <span className="h-px bg-[#d9d9d9]" />
            <span className="text-[16px] text-[#999999]">OR</span>
            <span className="h-px bg-[#d9d9d9]" />
          </div>

          <form noValidate className="mt-6" onSubmit={onSubmitEmail}>
            <label
              className="block text-[14px] text-[#5f5f5f]"
              htmlFor={emailId}
            >
              Email
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
              placeholder="Enter Your Email"
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
              className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Sending code…" : "Continue"}
              {submitting ? null : <ArrowIcon />}
            </button>
          </form>
        </>
      ) : (
        <form noValidate className="mt-8" onSubmit={onSubmitCode}>
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
            aria-describedby={errors.code ? codeErrorId : undefined}
            aria-invalid={errors.code ? true : undefined}
            autoComplete="one-time-code"
            className="mt-2 h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 text-center text-[20px] font-semibold tracking-[0.4em] text-[#1a1c21] outline-none placeholder:text-[#c4c4c4] placeholder:tracking-normal placeholder:font-normal placeholder:text-[16px] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
            id={codeId}
            inputMode="numeric"
            maxLength={8}
            name="code"
            pattern="[0-9]*"
            placeholder="123456"
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/[^0-9]/g, ""));
              if (errors.code) {
                setErrors((prev) => ({ ...prev, code: undefined }));
              }
            }}
          />

          {errors.code ? (
            <p
              className="mt-1.5 text-[13px] text-[#f12c23]"
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
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting || code.length === 0}
            type="submit"
          >
            {submitting ? "Verifying…" : "Continue"}
            {submitting ? null : <ArrowIcon />}
          </button>

          {canResendInline ? (
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
      {notice && step === "email" ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      {step === "email" ? (
        <p className="mt-6 text-center text-[16px] text-[#5f5f5f]">
          Don’t have an account yet?{" "}
          <Link
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
            href={
              afterSignInPath !== ROUTES.APP.DASHBOARD
                ? `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(afterSignInPath)}`
                : ROUTES.AUTH.SIGN_UP
            }
          >
            Sign Up
          </Link>
        </p>
      ) : null}
    </section>
  );
}

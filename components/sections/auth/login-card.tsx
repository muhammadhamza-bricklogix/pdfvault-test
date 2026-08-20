"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { PasswordRevealToggle } from "@/components/ui/form/password-reveal-toggle";
import { ROUTES } from "@/lib/shared/constants/routes";
import { authSignInSchema } from "@/lib/shared/schemas/auth/sign-in.schema";
import { EVENTS } from "@/lib/shared/utils/analytics-events";
import { logger } from "@/lib/shared/utils/logger";

import { GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
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

// Flow:
//   1. "credentials" → email + password submitted via signIn.create({
//                      identifier, password }). If Clerk returns
//                      status "complete", finalize immediately. If it
//                      returns "needs_second_factor", advance to
//                      "twoFactor" (invariant #16 — 2FA-enabled
//                      accounts must not silently loop back).
//   2. "twoFactor" → preserved 2FA path (email/phone/TOTP/backup).
type Step = "credentials" | "twoFactor";

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

export function LoginCard() {
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
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
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

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
        window.location.assign(decorateUrl(afterSignInPath));
      },
    });

    if (finalizeError) {
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
      await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: ROUTES.AUTH.SSO_CALLBACK,
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

  const onSubmitCredentials = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    if (!signIn) return;

    const trimmedEmail = email.trim();
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

    setEmail(trimmedEmail);
    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      const { error: createError } = await signIn.create({
        identifier: trimmedEmail,
        password,
      });

      if (createError) {
        const msg = readClerkError(
          createError,
          "Couldn't sign you in. Please try again.",
        );
        // Pin the message to the field that caused it when we can tell —
        // avoids the "form error" bar hiding underneath a valid-looking
        // form.
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

    const trimmedCode = code.trim();

    if (trimmedCode.length === 0) {
      setErrors({ code: "Enter the code we sent you." });

      return;
    }

    setErrors({});
    setNotice(null);
    setSubmitting(true);

    try {
      const verifyResult = await verifySecondFactor(trimmedCode);
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
        logger.event(EVENTS.SIGNIN_2FA_COMPLETE, "info", {
          strategy: secondFactorStrategy,
        });
        await finalizeAndRedirect();

        return;
      }

      setErrors({ code: "Verification didn't finish. Try again." });
      setSubmitting(false);
    } catch (err) {
      logger.captureError(err, "signin.2fa_verify", {
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
    if (
      secondFactorStrategy !== "email_code" &&
      secondFactorStrategy !== "phone_code"
    ) {
      // TOTP / backup codes are user-generated — nothing to resend.
      return;
    }

    setErrors({});
    setResending(true);

    try {
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

  const forgotPasswordHref =
    afterSignInPath !== ROUTES.APP.DASHBOARD
      ? `${ROUTES.AUTH.FORGOT_PASSWORD}?redirect_url=${encodeURIComponent(afterSignInPath)}`
      : ROUTES.AUTH.FORGOT_PASSWORD;

  const signUpHref =
    afterSignInPath !== ROUTES.APP.DASHBOARD
      ? `${ROUTES.AUTH.SIGN_UP}?redirect_url=${encodeURIComponent(afterSignInPath)}`
      : ROUTES.AUTH.SIGN_UP;

  const isTwoFactor = step === "twoFactor";

  return (
    <section
      aria-labelledby={headingId}
      className="box-border w-[min(446px,calc(100vw-32px))] rounded-[18px] border border-[#e1ebed] bg-white px-8 pb-9 pt-[38px] shadow-[0_8px_24px_rgba(28,46,51,0.08)] sm:min-h-[562px]"
    >
      <h1
        className="text-center text-[24px] font-semibold leading-[30px] text-[#1a1c21]"
        id={headingId}
      >
        {isTwoFactor ? "Check your email" : "Good to see you back!"}
      </h1>
      <p className="mt-2 text-center text-[14px] leading-5 text-[#666666]">
        {isTwoFactor
          ? secondFactorStrategy === "phone_code"
            ? `We sent a 6-digit code to your phone.`
            : `We sent a 6-digit code to ${email}.`
          : "Please enter your details below to log in."}
      </p>

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

          <form noValidate className="mt-6" onSubmit={onSubmitCredentials}>
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

            <label
              className="mt-4 block text-[14px] text-[#5f5f5f]"
              htmlFor={passwordId}
            >
              Password
              <span aria-hidden className="text-[#f12c23]">
                *
              </span>
            </label>
            <div className="relative mt-2">
              <input
                required
                aria-describedby={errors.password ? passwordErrorId : undefined}
                aria-invalid={errors.password ? true : undefined}
                autoComplete="current-password"
                className="h-[52px] w-full rounded-[12px] bg-[#f7f7f7] px-3 pr-11 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40"
                id={passwordId}
                name="password"
                placeholder="Enter Your Password"
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

            {/* Remember me + Forgot password. Clerk manages session TTL
                server-side via its Sessions settings, so the checkbox is
                intentionally cosmetic here — remove the checkbox if the
                team decides not to display it rather than wiring it to
                localStorage, which would set false expectations. */}
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
              <Link
                className="text-[#5f5f5f] underline-offset-2 hover:text-[#f12c23] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
                href={forgotPasswordHref}
              >
                Forgot password?
              </Link>
            </div>

            {errors.form ? (
              <p
                className="mt-3 text-[13px] text-[#f12c23]"
                id={formErrorId}
                role="alert"
              >
                {errors.form}
              </p>
            ) : null}

            <button
              className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
              disabled={submitting}
              type="submit"
            >
              {submitting ? "Signing in…" : "Log in"}
            </button>
          </form>
        </>
      ) : (
        <form noValidate className="mt-8" onSubmit={onSubmitCode}>
          <button
            className="mb-4 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[#666666] hover:text-[#1a1c21]"
            type="button"
            onClick={goBackToCredentials}
          >
            <BackChevron />
            Use different credentials
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
            className="mt-4 flex h-[58px] w-full cursor-pointer items-center justify-center rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
            disabled={submitting || code.length === 0}
            type="submit"
          >
            {submitting ? "Verifying…" : "Verify & continue"}
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
      {notice && isTwoFactor ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      {step === "credentials" ? (
        <p className="mt-6 text-center text-[15px] text-[#5f5f5f]">
          Do not have an account yet?{" "}
          <Link
            className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
            href={signUpHref}
          >
            Sign up
          </Link>
        </p>
      ) : null}
    </section>
  );
}

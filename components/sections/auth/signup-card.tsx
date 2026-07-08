"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

import { AppleIcon, GoogleIcon, OAUTH_BUTTON_CLASS } from "./auth-oauth";

// Reasonable email check — not an overly strict regex (per the design spec).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Same semantics as use-sign-in-flow's safeRedirectPath: only allow same-site
// paths from ?redirect_url, otherwise fall back to the dashboard.
function safeRedirectPath(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return fallback;
  }

  return raw;
}

type FieldErrors = {
  email?: string;
  fullName?: string;
  password?: string;
};

const INPUT_CLASS =
  "mt-2 h-[52px] w-full rounded-[10px] bg-[#f7f7f7] px-3 text-[16px] text-[#5f5f5f] outline-none placeholder:text-[#9a9a9a] focus-visible:ring-2 focus-visible:ring-[#f12c23]/40";

const LABEL_CLASS = "block text-[14px] leading-[18px] text-[#6f6f6f]";

export function SignupCard() {
  const { signUp } = useSignUp();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const headingId = useId();
  const fullNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const statusId = useId();

  const afterSignUpPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  // Same Clerk flow as the working sign-up page (use-sign-up-flow.ts):
  // signUp.sso redirects through /sso-callback, which handles the transfer
  // cases (existing account → sign-in) and routes to the destination.
  const onGoogle = async () => {
    setErrors({});
    setNotice(null);
    setOauthLoading(true);

    try {
      await signUp.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: afterSignUpPath,
        redirectUrl: ROUTES.AUTH.SSO_CALLBACK,
      });
    } catch (err) {
      logger.error("Google sign-up failed", err);
      setNotice("Something went wrong with Google sign-up.");
      setOauthLoading(false);
    }
  };

  // TODO(auth): wire Apple like onGoogle once the provider is enabled in the
  // Clerk dashboard. Kept as a clearly-named boundary — it must NOT fake a
  // successful sign-up.
  const onApple = () => {
    setErrors({});
    setNotice("Apple sign-up isn’t connected yet.");
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};

    if (!fullName.trim()) {
      nextErrors.fullName = "Please enter your full name.";
    }
    if (!EMAIL_RE.test(email.trim())) {
      nextErrors.email = "Please enter a valid email address.";
    }
    if (!password) {
      nextErrors.password = "Please enter a password.";
    }

    setNotice(null);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }
    // TODO(auth): hand the values to the existing Clerk email sign-up flow
    // (signUp.password + the email-verification-code step, see
    // use-sign-up-flow.ts) once that step has a designed screen. No fake
    // success here.
    setNotice(`Email sign-up isn’t connected yet (${email.trim()}).`);
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
        Create a Free Account
      </h1>
      <p className="mt-2.5 text-center text-[14px] leading-5 text-[#666666]">
        Unlimited Downloads, Shares, And Printing.
      </p>

      {/* OAuth providers */}
      <div className="mt-[34px] flex flex-col gap-[13px]">
        <button
          className={OAUTH_BUTTON_CLASS}
          disabled={oauthLoading}
          type="button"
          onClick={onApple}
        >
          <AppleIcon />
          Continue with Apple
        </button>
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

      {/* Divider — the signup reference uses the darker #9d9d9d lines */}
      <div className="mx-[5px] mt-[30px] grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <span className="h-px bg-[#9d9d9d]" />
        <span className="text-[16px] text-[#9d9d9d]">
          Or sign in with email
        </span>
        <span className="h-px bg-[#9d9d9d]" />
      </div>

      {/* Signup form */}
      <form noValidate className="mt-[30px]" onSubmit={onSubmit}>
        <div>
          <label className={LABEL_CLASS} htmlFor={fullNameId}>
            Your Fullname
            <span aria-hidden className="text-[#f12c23]">
              *
            </span>
          </label>
          <input
            required
            aria-describedby={
              errors.fullName ? `${fullNameId}-error` : undefined
            }
            aria-invalid={errors.fullName ? true : undefined}
            autoComplete="name"
            className={INPUT_CLASS}
            id={fullNameId}
            name="fullName"
            placeholder="Ammy Oginni"
            spellCheck={false}
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          {errors.fullName ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={`${fullNameId}-error`}
              role="alert"
            >
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
            aria-describedby={errors.email ? `${emailId}-error` : undefined}
            aria-invalid={errors.email ? true : undefined}
            autoComplete="email"
            className={INPUT_CLASS}
            id={emailId}
            inputMode="email"
            name="email"
            placeholder="ammy@theblanck.co"
            spellCheck={false}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          {errors.email ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={`${emailId}-error`}
              role="alert"
            >
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
          <input
            required
            aria-describedby={
              errors.password ? `${passwordId}-error` : undefined
            }
            aria-invalid={errors.password ? true : undefined}
            autoComplete="new-password"
            className={INPUT_CLASS}
            id={passwordId}
            name="password"
            placeholder="********"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {errors.password ? (
            <p
              className="mt-2 text-[13px] text-[#f12c23]"
              id={`${passwordId}-error`}
              role="alert"
            >
              {errors.password}
            </p>
          ) : null}
        </div>

        <button
          className="mt-4 flex h-[56px] w-full items-center justify-center rounded-[10px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
          type="submit"
        >
          Create Account
        </button>
      </form>

      {/* Non-faking status region for the stubbed provider/email handlers */}
      <p aria-live="polite" className="sr-only" id={statusId}>
        {notice}
      </p>
      {notice ? (
        <p className="mt-3 text-center text-[13px] text-[#666666]">{notice}</p>
      ) : null}

      {/* The reference copy really does say "Don’t have an account yet?" on
          the signup screen — match it exactly per the spec. */}
      <p className="mt-[28px] text-center text-[16px] text-[#4c4c4c]">
        Don’t have an account yet?{" "}
        <Link
          className="text-[#f12c23] underline underline-offset-2 hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23]"
          href={ROUTES.AUTH.LOGIN}
        >
          Sign In
        </Link>
      </p>
    </section>
  );
}

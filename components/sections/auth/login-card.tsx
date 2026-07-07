"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { ROUTES } from "@/lib/shared/constants/routes";
import { logger } from "@/lib/shared/utils/logger";

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

function AppleIcon() {
  return (
    <svg
      aria-hidden
      fill="currentColor"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.09-2.01-3.76-2.04-1.6-.16-3.12.94-3.93.94-.81 0-2.06-.92-3.39-.9-1.74.03-3.35 1.01-4.25 2.57-1.81 3.14-.46 7.79 1.3 10.34.86 1.25 1.88 2.65 3.22 2.6 1.29-.05 1.78-.83 3.34-.83 1.56 0 2 .83 3.37.81 1.39-.03 2.27-1.27 3.12-2.53.98-1.45 1.39-2.85 1.41-2.92-.03-.01-2.71-1.04-2.74-4.13ZM14.53 4.42c.71-.86 1.19-2.06 1.06-3.25-1.02.04-2.26.68-2.99 1.54-.66.76-1.23 1.98-1.08 3.15 1.14.09 2.3-.58 3.01-1.44Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden height="20" viewBox="0 0 24 24" width="20">
      <path
        d="M23.06 12.25c0-.86-.07-1.5-.22-2.16H12.24v3.92h6.19c-.12 1-.8 2.5-2.3 3.51l-.02.14 3.34 2.59.23.02c2.12-1.96 3.34-4.85 3.34-8.02Z"
        fill="#4285F4"
      />
      <path
        d="M12.24 24c3.03 0 5.57-1 7.43-2.72l-3.54-2.75c-.95.66-2.22 1.12-3.89 1.12-2.97 0-5.49-1.96-6.39-4.67l-.13.01-3.47 2.69-.05.13C4.58 21.3 8.13 24 12.24 24Z"
        fill="#34A853"
      />
      <path
        d="M5.85 14.98c-.24-.7-.37-1.45-.37-2.23s.13-1.53.36-2.23l-.01-.15-3.51-2.73-.11.05A11.99 11.99 0 0 0 0 12.75c0 1.94.46 3.77 1.29 5.4l4.56-3.17Z"
        fill="#FBBC05"
      />
      <path
        d="M12.24 4.75c2.11 0 3.53.91 4.34 1.67l3.17-3.09C17.8 1.44 15.27 0 12.24 0 8.13 0 4.58 2.7 1.29 6.35l4.55 3.4c.91-2.71 3.43-5 6.4-5Z"
        fill="#EA4335"
      />
    </svg>
  );
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

const OAUTH_BUTTON =
  "flex h-[46px] w-full items-center justify-center gap-3.5 rounded-[12px] border border-[#e1ebed] bg-white text-[16px] text-[#5f5f5f] shadow-[0_5px_12px_rgba(24,39,45,0.08)] transition-colors hover:bg-[#fafbfb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] disabled:opacity-60";

export function LoginCard() {
  const { signIn } = useSignIn();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const emailId = useId();
  const errorId = useId();
  const statusId = useId();

  const afterSignInPath = useMemo(
    () =>
      safeRedirectPath(searchParams.get("redirect_url"), ROUTES.APP.DASHBOARD),
    [searchParams],
  );

  // Same Clerk flow as the working /sign-in page (use-sign-in-flow.ts):
  // signIn.sso redirects through /sso-callback, which handles the transfer
  // cases and routes to the dashboard.
  const onGoogle = async () => {
    setError(null);
    setNotice(null);
    setOauthLoading(true);

    try {
      await signIn.sso({
        strategy: "oauth_google",
        redirectCallbackUrl: afterSignInPath,
        redirectUrl: ROUTES.AUTH.SSO_CALLBACK,
      });
    } catch (err) {
      logger.error("Google sign-in failed", err);
      setError("Something went wrong with Google sign-in.");
      setOauthLoading(false);
    }
  };

  // TODO(auth): wire Apple like onGoogle once the provider is enabled in the
  // Clerk dashboard. Kept as a clearly-named boundary — it must NOT fake a
  // successful sign-in.
  const onApple = () => {
    setError(null);
    setNotice("Apple sign-in isn’t connected yet.");
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = email.trim();

    setNotice(null);
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email address.");

      return;
    }
    setError(null);
    // TODO(auth): hand the normalized email to the existing Clerk email-first
    // sign-in flow and navigate to the next step. No fake success here.
    setNotice(`Email sign-in isn’t connected yet (${value}).`);
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
        Please enter your details below to sign in
      </p>

      {/* OAuth providers */}
      <div className="mt-[30px] flex flex-col gap-3">
        <button
          className={OAUTH_BUTTON}
          disabled={oauthLoading}
          type="button"
          onClick={onApple}
        >
          <AppleIcon />
          Login with Apple
        </button>
        <button
          className={OAUTH_BUTTON}
          disabled={oauthLoading}
          type="button"
          onClick={onGoogle}
        >
          <GoogleIcon />
          {oauthLoading ? "Connecting to Google…" : "Login with Google"}
        </button>
      </div>

      {/* Divider */}
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <span className="h-px bg-[#d9d9d9]" />
        <span className="text-[16px] text-[#999999]">
          Or sign in with email
        </span>
        <span className="h-px bg-[#d9d9d9]" />
      </div>

      {/* Email form */}
      <form noValidate className="mt-6" onSubmit={onSubmit}>
        <label className="block text-[14px] text-[#5f5f5f]" htmlFor={emailId}>
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
          placeholder="ammy@theblanck.co"
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
          className="mt-4 flex h-[58px] w-full items-center justify-center gap-2.5 rounded-[11px] bg-[#f12c23] text-[16px] font-semibold text-white transition-colors hover:bg-[#d21f17] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f12c23] active:translate-y-px"
          type="submit"
        >
          Continue
          <ArrowIcon />
        </button>
      </form>

      {/* Non-faking status region for the stubbed provider/email handlers */}
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

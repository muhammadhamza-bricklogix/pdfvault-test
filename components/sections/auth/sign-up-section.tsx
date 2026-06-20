"use client";

import { Button, Fieldset, Form, Separator } from "@heroui/react";

import { AuthShell } from "@/components/sections/auth/auth-shell";
import { GoogleLogo, OAuthButton } from "@/components/ui/auth/oauth-button";
import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledOtpField } from "@/components/ui/form/controlled-otp-field";
import { useSignUpFlow } from "@/lib/client/hooks/auth/use-sign-up-flow";
import { ROUTES } from "@/lib/shared/constants/routes";

export function SignUpSection() {
  const {
    credentialsForm,
    fetchStatus,
    handleCredentialsSubmit,
    handleGoogleSignUp,
    handleResendCode,
    handleStartOver,
    handleVerificationSubmit,
    oauthLoading,
    verificationForm,
    verificationMode,
  } = useSignUpFlow();

  const isLoading = fetchStatus === "fetching";

  return (
    <AuthShell
      alternateHref={ROUTES.AUTH.SIGN_IN}
      alternateLabel="Sign in"
      alternateText="Already have an account?"
      description="Create your account with email and password, then confirm the verification code we send before you land back in the app."
      title="Create your PDFedits.io account"
    >
      {verificationMode ? (
        <Form onSubmit={handleVerificationSubmit}>
          <Fieldset className="space-y-5">
            <Fieldset.Legend className="text-2xl font-semibold tracking-tight">
              Verify your email
            </Fieldset.Legend>
            <Fieldset.Group className="space-y-4">
              <ControlledOtpField
                control={verificationForm.control}
                label="Verification code"
                length={6}
                name="code"
              />
            </Fieldset.Group>
            <Fieldset.Actions className="flex flex-wrap items-center gap-3">
              <Button isDisabled={isLoading} type="submit">
                {isLoading ? "Verifying..." : "Verify email"}
              </Button>
              <Button
                isDisabled={isLoading}
                type="button"
                variant="ghost"
                onPress={handleResendCode}
              >
                Resend code
              </Button>
              <Button
                isDisabled={isLoading}
                type="button"
                variant="outline"
                onPress={handleStartOver}
              >
                Start over
              </Button>
            </Fieldset.Actions>
          </Fieldset>
        </Form>
      ) : (
        <div className="space-y-5">
          <Fieldset.Legend className="text-2xl font-semibold tracking-tight">
            Set up your account
          </Fieldset.Legend>

          <OAuthButton
            icon={<GoogleLogo />}
            isDisabled={isLoading || oauthLoading}
            label="Continue with Google"
            onPress={handleGoogleSignUp}
          />

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-default-500">or</span>
            <Separator className="flex-1" />
          </div>

          <Form onSubmit={handleCredentialsSubmit}>
            <Fieldset className="space-y-5">
              <Fieldset.Group className="space-y-4">
                <ControlledInputField
                  autoComplete="email"
                  control={credentialsForm.control}
                  label="Email address"
                  name="emailAddress"
                  placeholder="you@example.com"
                  type="email"
                />
                <ControlledInputField
                  autoComplete="new-password"
                  control={credentialsForm.control}
                  description="Use at least 8 characters."
                  label="Password"
                  name="password"
                  placeholder="Create a password"
                  type="password"
                />
              </Fieldset.Group>
              <Fieldset.Actions>
                <Button isDisabled={isLoading || oauthLoading} type="submit">
                  {isLoading ? "Creating account..." : "Continue"}
                </Button>
              </Fieldset.Actions>
            </Fieldset>
          </Form>
        </div>
      )}
      <div id="clerk-captcha" />
    </AuthShell>
  );
}

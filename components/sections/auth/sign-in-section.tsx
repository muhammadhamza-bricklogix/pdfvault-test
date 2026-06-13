"use client";

import { Button, Fieldset, Form, Separator } from "@heroui/react";

import { AuthShell } from "@/components/sections/auth/auth-shell";
import { GoogleLogo, OAuthButton } from "@/components/ui/auth/oauth-button";
import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledOtpField } from "@/components/ui/form/controlled-otp-field";
import { useSignInFlow } from "@/lib/client/hooks/auth/use-sign-in-flow";
import { ROUTES } from "@/lib/shared/constants/routes";

export function SignInSection() {
  const {
    credentialsForm,
    fetchStatus,
    handleBackToCredentials,
    handleCredentialsSubmit,
    handleGoogleSignIn,
    handleResendCode,
    handleVerificationSubmit,
    oauthLoading,
    verificationForm,
    verificationMode,
  } = useSignInFlow();

  const isLoading = fetchStatus === "fetching";

  return (
    <AuthShell
      alternateHref={ROUTES.AUTH.SIGN_UP}
      alternateLabel="Create one"
      alternateText="Need an account?"
      description="Use your email address and password to get into PDFedits.io. If Clerk asks for an extra check, we keep that verification inside this route."
      title="Sign in to your PDFedits.io workspace"
    >
      {verificationMode ? (
        <Form onSubmit={handleVerificationSubmit}>
          <Fieldset className="space-y-5">
            <Fieldset.Legend className="text-2xl font-semibold tracking-tight">
              Verify your sign-in
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
                {isLoading ? "Verifying..." : "Verify code"}
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
                onPress={handleBackToCredentials}
              >
                Back
              </Button>
            </Fieldset.Actions>
          </Fieldset>
        </Form>
      ) : (
        <div className="space-y-5">
          <Fieldset.Legend className="text-2xl font-semibold tracking-tight">
            Welcome back
          </Fieldset.Legend>

          <OAuthButton
            icon={<GoogleLogo />}
            isDisabled={isLoading || oauthLoading}
            label="Continue with Google"
            onPress={handleGoogleSignIn}
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
                  autoComplete="current-password"
                  control={credentialsForm.control}
                  label="Password"
                  name="password"
                  placeholder="Enter your password"
                  type="password"
                />
              </Fieldset.Group>
              <Fieldset.Actions>
                <Button isDisabled={isLoading || oauthLoading} type="submit">
                  {isLoading ? "Signing in..." : "Sign in"}
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

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSignUp } from "@clerk/nextjs";
import { Button, Fieldset, Form, Separator } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthShell } from "@/components/sections/auth/auth-shell";
import { GoogleLogo, OAuthButton } from "@/components/ui/auth/oauth-button";
import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledOtpField } from "@/components/ui/form/controlled-otp-field";
import { ROUTES } from "@/lib/shared/constants/routes";
import {
  authVerificationCodeSchema,
  authSignUpSchema,
  type AuthVerificationCodeFormValues,
  type AuthSignUpFormValues,
} from "@/lib/shared/schemas/auth";
import {
  getClerkErrorMessage,
  getClerkGlobalErrorMessage,
} from "@/lib/shared/utils/auth.clerk-error";
import { logger } from "@/lib/shared/utils/logger";

type SignUpStep = "credentials" | "verification";

export function SignUpSection() {
  const { errors, fetchStatus, signUp } = useSignUp();
  const router = useRouter();
  const [step, setStep] = useState<SignUpStep>("credentials");

  const credentialsForm = useForm<AuthSignUpFormValues>({
    defaultValues: {
      emailAddress: "",
      password: "",
    },
    resolver: zodResolver(authSignUpSchema),
  });

  const verificationForm = useForm<AuthVerificationCodeFormValues>({
    defaultValues: {
      code: "",
    },
    resolver: zodResolver(authVerificationCodeSchema),
  });

  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setOauthLoading(true);
    credentialsForm.clearErrors();

    try {
      await signUp.sso({
        strategy: "oauth_google",
        redirectUrl: ROUTES.AUTH.SSO_CALLBACK,
        redirectCallbackUrl: ROUTES.PUBLIC.HOME,
      });
    } catch (error) {
      logger.error("Google sign-up failed", error);
      credentialsForm.setError("root.server", {
        message: "Something went wrong with Google sign-up.",
        type: "server",
      });
      setOauthLoading(false);
    }
  };

  const verificationMode =
    step === "verification" ||
    (signUp.status === "missing_requirements" &&
      signUp.unverifiedFields.includes("email_address") &&
      signUp.missingFields.length === 0);

  const activeGlobalError = getClerkGlobalErrorMessage(errors.global);

  useEffect(() => {
    const emailError = getClerkErrorMessage(errors.fields.emailAddress);
    const passwordError = getClerkErrorMessage(errors.fields.password);
    const codeError = getClerkErrorMessage(errors.fields.code);
    const captchaError = getClerkErrorMessage(errors.fields.captcha);

    if (emailError) {
      credentialsForm.setError("emailAddress", {
        message: emailError,
        type: "server",
      });
    }

    if (passwordError) {
      credentialsForm.setError("password", {
        message: passwordError,
        type: "server",
      });
    }

    if (codeError) {
      verificationForm.setError("code", {
        message: codeError,
        type: "server",
      });
    }

    const formMessage = activeGlobalError ?? captchaError;

    if (formMessage) {
      const targetForm = verificationMode ? verificationForm : credentialsForm;

      targetForm.setError("root.server", {
        message: formMessage,
        type: "server",
      });
    }
  }, [
    activeGlobalError,
    credentialsForm,
    errors.fields.captcha,
    errors.fields.code,
    errors.fields.emailAddress,
    errors.fields.password,
    verificationForm,
    verificationMode,
  ]);

  const navigateToHome = async () => {
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(ROUTES.PUBLIC.HOME);

        if (url.startsWith("http")) {
          window.location.href = url;

          return;
        }

        router.push(url);
      },
    });

    if (error) {
      credentialsForm.setError("root.server", {
        message:
          getClerkErrorMessage(error) ?? "We could not finish signing you up.",
        type: "server",
      });
    }
  };

  const handleCredentialsSubmit = credentialsForm.handleSubmit(
    async (values) => {
      credentialsForm.clearErrors();
      verificationForm.clearErrors();

      try {
        const { error } = await signUp.password({
          emailAddress: values.emailAddress,
          password: values.password,
        });

        if (error) {
          const message = getClerkErrorMessage(error);

          if (message) {
            credentialsForm.setError("root.server", {
              message,
              type: "server",
            });
          }

          return;
        }

        const sendCodeResult = await signUp.verifications.sendEmailCode();

        if (sendCodeResult.error) {
          credentialsForm.setError("root.server", {
            message:
              getClerkErrorMessage(sendCodeResult.error) ??
              "We could not send the email verification code.",
            type: "server",
          });

          return;
        }

        setStep("verification");
        verificationForm.reset({
          code: "",
        });
      } catch (error) {
        logger.error("Sign-up submission failed", error);
        credentialsForm.setError("root.server", {
          message: "Something went wrong while creating your account.",
          type: "server",
        });
      }
    },
  );

  const handleVerificationSubmit = verificationForm.handleSubmit(
    async (values) => {
      verificationForm.clearErrors();

      try {
        const { error } = await signUp.verifications.verifyEmailCode({
          code: values.code,
        });

        if (error) {
          const message = getClerkErrorMessage(error);

          if (message) {
            verificationForm.setError("root.server", {
              message,
              type: "server",
            });
          }

          return;
        }

        if (signUp.status === "complete") {
          await navigateToHome();

          return;
        }

        verificationForm.setError("root.server", {
          message: "Your account is not verified yet.",
          type: "server",
        });
      } catch (error) {
        logger.error("Sign-up verification failed", error);
        verificationForm.setError("root.server", {
          message: "Something went wrong while verifying your email.",
          type: "server",
        });
      }
    },
  );

  return (
    <AuthShell
      alternateHref={ROUTES.AUTH.SIGN_IN}
      alternateLabel="Sign in"
      alternateText="Already have an account?"
      description="Create your account with email and password, then confirm the verification code we send before you land back in the app."
      title="Create your PDFForge account"
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
                externalError={null}
                label="Verification code"
                length={6}
                name="code"
              />
              {verificationForm.formState.errors.root?.server?.message ? (
                <p className="text-sm text-[var(--color-danger)]">
                  {verificationForm.formState.errors.root.server.message}
                </p>
              ) : null}
            </Fieldset.Group>
            <Fieldset.Actions className="flex flex-wrap items-center gap-3">
              <Button isDisabled={fetchStatus === "fetching"} type="submit">
                {fetchStatus === "fetching" ? "Verifying..." : "Verify email"}
              </Button>
              <Button
                isDisabled={fetchStatus === "fetching"}
                type="button"
                variant="ghost"
                onPress={async () => {
                  const result = await signUp.verifications.sendEmailCode();

                  if (result.error) {
                    verificationForm.setError("root.server", {
                      message:
                        getClerkErrorMessage(result.error) ??
                        "We could not resend the email verification code.",
                      type: "server",
                    });
                  }
                }}
              >
                Resend code
              </Button>
              <Button
                isDisabled={fetchStatus === "fetching"}
                type="button"
                variant="outline"
                onPress={async () => {
                  await signUp.reset();
                  setStep("credentials");
                  credentialsForm.reset();
                  verificationForm.reset({ code: "" });
                }}
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
            isDisabled={fetchStatus === "fetching" || oauthLoading}
            label="Continue with Google"
            onPress={handleGoogleSignUp}
          />

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-xs text-[var(--app-muted)]">or</span>
            <Separator className="flex-1" />
          </div>

          <Form onSubmit={handleCredentialsSubmit}>
            <Fieldset className="space-y-5">
              <Fieldset.Group className="space-y-4">
                <ControlledInputField
                  autoComplete="email"
                  control={credentialsForm.control}
                  externalError={null}
                  label="Email address"
                  name="emailAddress"
                  placeholder="you@example.com"
                  type="email"
                />
                <ControlledInputField
                  autoComplete="new-password"
                  control={credentialsForm.control}
                  description="Use at least 8 characters."
                  externalError={null}
                  label="Password"
                  name="password"
                  placeholder="Create a password"
                  type="password"
                />
                {credentialsForm.formState.errors.root?.server?.message ? (
                  <p className="text-sm text-[var(--color-danger)]">
                    {credentialsForm.formState.errors.root.server.message}
                  </p>
                ) : null}
              </Fieldset.Group>
              <Fieldset.Actions>
                <Button
                  isDisabled={fetchStatus === "fetching" || oauthLoading}
                  type="submit"
                >
                  {fetchStatus === "fetching"
                    ? "Creating account..."
                    : "Continue"}
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

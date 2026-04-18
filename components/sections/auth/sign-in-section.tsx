"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSignIn } from "@clerk/nextjs";
import { Button, Fieldset, Form } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { AuthShell } from "@/components/sections/auth/auth-shell";
import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledOtpField } from "@/components/ui/form/controlled-otp-field";
import { ROUTES } from "@/lib/shared/constants/routes";
import {
  authSignInSchema,
  type AuthSignInFormValues,
} from "@/lib/shared/schemas/auth.sign-in.schema";
import {
  authVerificationCodeSchema,
  type AuthVerificationCodeFormValues,
} from "@/lib/shared/schemas/auth.verification-code.schema";
import {
  getClerkErrorMessage,
  getClerkGlobalErrorMessage,
} from "@/lib/shared/utils/auth.clerk-error";
import { logger } from "@/lib/shared/utils/logger";

type SignInStep = "credentials" | "verification";

export function SignInSection() {
  const { errors, fetchStatus, signIn } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<SignInStep>("credentials");

  const credentialsForm = useForm<AuthSignInFormValues>({
    defaultValues: {
      emailAddress: "",
      password: "",
    },
    resolver: zodResolver(authSignInSchema),
  });

  const verificationForm = useForm<AuthVerificationCodeFormValues>({
    defaultValues: {
      code: "",
    },
    resolver: zodResolver(authVerificationCodeSchema),
  });

  const verificationMode =
    signIn.status === "needs_client_trust" ||
    signIn.status === "needs_second_factor" ||
    step === "verification";

  const activeGlobalError = useMemo(
    () => getClerkGlobalErrorMessage(errors.global),
    [errors.global],
  );

  useEffect(() => {
    const emailError = getClerkErrorMessage(errors.fields.identifier);
    const passwordError = getClerkErrorMessage(errors.fields.password);
    const codeError = getClerkErrorMessage(errors.fields.code);

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

    if (activeGlobalError) {
      const targetForm = verificationMode ? verificationForm : credentialsForm;

      targetForm.setError("root.server", {
        message: activeGlobalError,
        type: "server",
      });
    }
  }, [
    activeGlobalError,
    credentialsForm,
    errors.fields.code,
    errors.fields.identifier,
    errors.fields.password,
    verificationForm,
    verificationMode,
  ]);

  const navigateToHome = async () => {
    const { error } = await signIn.finalize({
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
          getClerkErrorMessage(error) ?? "We could not finish signing you in.",
        type: "server",
      });
    }
  };

  const beginEmailVerification = async () => {
    const supportsEmailCode = signIn.supportedSecondFactors?.some(
      (factor) => factor.strategy === "email_code",
    );

    if (!supportsEmailCode) {
      credentialsForm.setError("root.server", {
        message:
          "This sign-in needs a second factor that is not yet supported in this custom flow.",
        type: "server",
      });

      return;
    }

    const { error } = await signIn.mfa.sendEmailCode();

    if (error) {
      credentialsForm.setError("root.server", {
        message:
          getClerkErrorMessage(error) ??
          "We could not send the verification code.",
        type: "server",
      });

      return;
    }

    setStep("verification");
    verificationForm.reset({
      code: "",
    });
  };

  const handleCredentialsSubmit = credentialsForm.handleSubmit(
    async (values) => {
      credentialsForm.clearErrors();
      verificationForm.clearErrors();

      try {
        const { error } = await signIn.password({
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

        if (signIn.status === "complete") {
          await navigateToHome();

          return;
        }

        if (
          signIn.status === "needs_client_trust" ||
          signIn.status === "needs_second_factor"
        ) {
          await beginEmailVerification();

          return;
        }

        credentialsForm.setError("root.server", {
          message: "The sign-in flow needs another step that is not ready yet.",
          type: "server",
        });
      } catch (error) {
        logger.error("Sign-in submission failed", error);
        credentialsForm.setError("root.server", {
          message: "Something went wrong while signing you in.",
          type: "server",
        });
      }
    },
  );

  const handleVerificationSubmit = verificationForm.handleSubmit(
    async (values) => {
      verificationForm.clearErrors();

      try {
        const { error } = await signIn.mfa.verifyEmailCode({
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

        if (signIn.status === "complete") {
          await navigateToHome();

          return;
        }

        verificationForm.setError("root.server", {
          message: "The verification step is not complete yet.",
          type: "server",
        });
      } catch (error) {
        logger.error("Sign-in verification failed", error);
        verificationForm.setError("root.server", {
          message: "Something went wrong while verifying your code.",
          type: "server",
        });
      }
    },
  );

  return (
    <AuthShell
      alternateHref={ROUTES.AUTH.SIGN_UP}
      alternateLabel="Create one"
      alternateText="Need an account?"
      description="Use your email address and password to get into PDFForge. If Clerk asks for an extra check, we keep that verification inside this route."
      eyebrow="Custom sign in"
      title="Sign in to your PDFForge workspace"
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
                {fetchStatus === "fetching" ? "Verifying..." : "Verify code"}
              </Button>
              <Button
                isDisabled={fetchStatus === "fetching"}
                type="button"
                variant="ghost"
                onPress={() => beginEmailVerification()}
              >
                Resend code
              </Button>
              <Button
                isDisabled={fetchStatus === "fetching"}
                type="button"
                variant="outline"
                onPress={() => {
                  setStep("credentials");
                  verificationForm.reset({ code: "" });
                }}
              >
                Back
              </Button>
            </Fieldset.Actions>
          </Fieldset>
        </Form>
      ) : (
        <Form onSubmit={handleCredentialsSubmit}>
          <Fieldset className="space-y-5">
            <Fieldset.Legend className="text-2xl font-semibold tracking-tight">
              Welcome back
            </Fieldset.Legend>
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
                autoComplete="current-password"
                control={credentialsForm.control}
                externalError={null}
                label="Password"
                name="password"
                placeholder="Enter your password"
                type="password"
              />
              {credentialsForm.formState.errors.root?.server?.message ? (
                <p className="text-sm text-[var(--color-danger)]">
                  {credentialsForm.formState.errors.root.server.message}
                </p>
              ) : null}
            </Fieldset.Group>
            <Fieldset.Actions>
              <Button isDisabled={fetchStatus === "fetching"} type="submit">
                {fetchStatus === "fetching" ? "Signing in..." : "Sign in"}
              </Button>
            </Fieldset.Actions>
          </Fieldset>
        </Form>
      )}
    </AuthShell>
  );
}

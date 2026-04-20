"use client";

import type { AuthSignInFormValues } from "@/lib/shared/schemas/auth";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSignIn } from "@clerk/nextjs";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ROUTES } from "@/lib/shared/constants/routes";
import {
  authSignInSchema,
  authVerificationCodeSchema,
  type AuthVerificationCodeFormValues,
} from "@/lib/shared/schemas/auth";
import { parseClerkError } from "@/lib/shared/utils/auth.clerk-error";
import { logger } from "@/lib/shared/utils/logger";

type SignInStep = "credentials" | "verification";

function showServerError(message: string) {
  toast.danger(message);
}

export function useSignInFlow() {
  const { fetchStatus, signIn } = useSignIn();
  const router = useRouter();
  const [step, setStep] = useState<SignInStep>("credentials");
  const [oauthLoading, setOauthLoading] = useState(false);

  const credentialsForm = useForm<AuthSignInFormValues>({
    defaultValues: { emailAddress: "", password: "" },
    resolver: zodResolver(authSignInSchema),
  });

  const verificationForm = useForm<AuthVerificationCodeFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(authVerificationCodeSchema),
  });

  const verificationMode =
    signIn.status === "needs_client_trust" ||
    signIn.status === "needs_second_factor" ||
    step === "verification";

  const applyClerkError = (error: unknown) => {
    const { fieldErrors, serverError } = parseClerkError(
      error as Parameters<typeof parseClerkError>[0],
    );

    for (const [field, message] of Object.entries(fieldErrors)) {
      if (field in credentialsForm.getValues()) {
        credentialsForm.setError(field as keyof AuthSignInFormValues, {
          message,
          type: "server",
        });
      } else if (field in verificationForm.getValues()) {
        verificationForm.setError(
          field as keyof AuthVerificationCodeFormValues,
          { message, type: "server" },
        );
      } else {
        showServerError(message);
      }
    }

    if (serverError) {
      showServerError(serverError);
    }
  };

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
      applyClerkError(error);
    }
  };

  const beginEmailVerification = async () => {
    const supportsEmailCode = signIn.supportedSecondFactors?.some(
      (factor) => factor.strategy === "email_code",
    );

    if (!supportsEmailCode) {
      showServerError(
        "This sign-in needs a second factor that is not yet supported in this custom flow.",
      );

      return;
    }

    const { error } = await signIn.mfa.sendEmailCode();

    if (error) {
      showServerError("We could not send the verification code.");

      return;
    }

    setStep("verification");
    verificationForm.reset({ code: "" });
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading(true);
    credentialsForm.clearErrors();

    try {
      await signIn.sso({
        strategy: "oauth_google",
        redirectUrl: ROUTES.AUTH.SSO_CALLBACK,
        redirectCallbackUrl: ROUTES.PUBLIC.HOME,
      });
    } catch (error) {
      logger.error("Google sign-in failed", error);
      showServerError("Something went wrong with Google sign-in.");
      setOauthLoading(false);
    }
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
          applyClerkError(error);

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

        showServerError(
          "The sign-in flow needs another step that is not ready yet.",
        );
      } catch (error) {
        logger.error("Sign-in submission failed", error);
        showServerError("Something went wrong while signing you in.");
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
          applyClerkError(error);

          return;
        }

        if (signIn.status === "complete") {
          await navigateToHome();

          return;
        }

        showServerError("The verification step is not complete yet.");
      } catch (error) {
        logger.error("Sign-in verification failed", error);
        showServerError("Something went wrong while verifying your code.");
      }
    },
  );

  const handleResendCode = () => beginEmailVerification();

  const handleBackToCredentials = () => {
    setStep("credentials");
    verificationForm.reset({ code: "" });
  };

  return {
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
  };
}

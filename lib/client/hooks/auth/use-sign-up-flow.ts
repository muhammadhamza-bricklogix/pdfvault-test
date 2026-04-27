"use client";

import type { AuthSignUpFormValues } from "@/lib/shared/schemas/auth";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSignUp } from "@clerk/nextjs";
import { toast } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { ROUTES } from "@/lib/shared/constants/routes";
import {
  authSignUpSchema,
  authVerificationCodeSchema,
  type AuthVerificationCodeFormValues,
} from "@/lib/shared/schemas/auth";
import { parseClerkError } from "@/lib/shared/utils/clerk-error";
import { logger } from "@/lib/shared/utils/logger";

type SignUpStep = "credentials" | "verification";

function showServerError(message: string) {
  toast.danger(message);
}

export function useSignUpFlow() {
  const { fetchStatus, signUp } = useSignUp();
  const router = useRouter();
  const [step, setStep] = useState<SignUpStep>("credentials");
  const [oauthLoading, setOauthLoading] = useState(false);

  const credentialsForm = useForm<AuthSignUpFormValues>({
    defaultValues: { emailAddress: "", password: "" },
    resolver: zodResolver(authSignUpSchema),
  });

  const verificationForm = useForm<AuthVerificationCodeFormValues>({
    defaultValues: { code: "" },
    resolver: zodResolver(authVerificationCodeSchema),
  });

  const verificationMode =
    step === "verification" ||
    (signUp.status === "missing_requirements" &&
      signUp.unverifiedFields.includes("email_address") &&
      signUp.missingFields.length === 0);

  const applyClerkError = (error: unknown) => {
    const { fieldErrors, serverError } = parseClerkError(
      error as Parameters<typeof parseClerkError>[0],
    );

    for (const [field, message] of Object.entries(fieldErrors)) {
      if (field in credentialsForm.getValues()) {
        credentialsForm.setError(field as keyof AuthSignUpFormValues, {
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
    const { error } = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(ROUTES.APP.DASHBOARD);

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

  const handleGoogleSignUp = async () => {
    setOauthLoading(true);
    credentialsForm.clearErrors();

    try {
      await signUp.sso({
        strategy: "oauth_google",
        redirectUrl: ROUTES.AUTH.SSO_CALLBACK,
        redirectCallbackUrl: ROUTES.APP.DASHBOARD,
      });
    } catch (error) {
      logger.error("Google sign-up failed", error);
      showServerError("Something went wrong with Google sign-up.");
      setOauthLoading(false);
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
          applyClerkError(error);

          return;
        }

        const sendCodeResult = await signUp.verifications.sendEmailCode();

        if (sendCodeResult.error) {
          applyClerkError(sendCodeResult.error);

          return;
        }

        setStep("verification");
        verificationForm.reset({ code: "" });
      } catch (error) {
        logger.error("Sign-up submission failed", error);
        showServerError("Something went wrong while creating your account.");
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
          applyClerkError(error);

          return;
        }

        if (signUp.status === "complete") {
          await navigateToHome();

          return;
        }

        showServerError("Your account is not verified yet.");
      } catch (error) {
        logger.error("Sign-up verification failed", error);
        showServerError("Something went wrong while verifying your email.");
      }
    },
  );

  const handleResendCode = async () => {
    const result = await signUp.verifications.sendEmailCode();

    if (result.error) {
      showServerError("We could not resend the email verification code.");
    }
  };

  const handleStartOver = async () => {
    await signUp.reset();
    setStep("credentials");
    credentialsForm.reset();
    verificationForm.reset({ code: "" });
  };

  return {
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
  };
}

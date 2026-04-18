import { z } from "zod";

export const authVerificationCodeSchema = z.object({
  code: z
    .string()
    .min(1, "Enter the verification code")
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export type AuthVerificationCodeFormValues = z.infer<
  typeof authVerificationCodeSchema
>;

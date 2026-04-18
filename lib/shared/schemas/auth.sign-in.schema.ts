import { z } from "zod";

export const authSignInSchema = z.object({
  emailAddress: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export type AuthSignInFormValues = z.infer<typeof authSignInSchema>;

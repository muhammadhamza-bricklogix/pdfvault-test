import { z } from "zod";

export const authSignUpSchema = z.object({
  emailAddress: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export type AuthSignUpFormValues = z.infer<typeof authSignUpSchema>;

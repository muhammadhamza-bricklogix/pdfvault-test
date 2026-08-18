import { z } from "zod";

// Password rules: 8+ chars, alphanumeric (must include at least one
// letter AND at least one digit). Deliberately loose — no upper/lower
// mix requirement, no special-char requirement, no breach check. The
// Clerk dashboard's "Reject compromised passwords" toggle must also be
// off, otherwise Clerk enforces its own stricter rules server-side and
// returns `form_password_pwned` on common passwords.
export const authSignUpSchema = z.object({
  emailAddress: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must contain at least 8 characters")
    .regex(/[A-Za-z]/, "Password must include at least one letter")
    .regex(/[0-9]/, "Password must include at least one number"),
});

export type AuthSignUpFormValues = z.infer<typeof authSignUpSchema>;

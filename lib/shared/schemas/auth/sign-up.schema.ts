import { z } from "zod";

// Password rules (2026-08-30 PM ask): just 8+ characters, no
// content constraints. Dropped the previous "must include at least
// one letter AND one digit" pair of regex rules — users can now
// pick any 8-char password of their choice.
//
// The server-side breach check ("Reject compromised passwords") must
// also be turned OFF in the Clerk dashboard for this loose policy to
// hold end-to-end — otherwise Clerk returns `form_password_pwned`
// on common passwords like `password1` even though the schema
// accepts them. Toggle at:
//   Clerk dashboard → Configure → User & Authentication →
//   Password → uncheck "Reject compromised passwords".
export const authSignUpSchema = z.object({
  emailAddress: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  password: z.string().min(8, "Password must contain at least 8 characters"),
});

export type AuthSignUpFormValues = z.infer<typeof authSignUpSchema>;

import { z } from "zod";

export const contactFormSchema = z.object({
  email: z
    .string()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
  firstName: z.string().min(1, "Enter your first name"),
  lastName: z.string().min(1, "Enter your last name"),
  message: z.string().min(1, "Enter your message"),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

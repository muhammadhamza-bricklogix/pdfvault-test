"use client";

import type { ContactFormValues } from "@/lib/shared/schemas/contact.schema";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Fieldset, Form } from "@heroui/react";
import { useForm } from "react-hook-form";

import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledTextareaField } from "@/components/ui/form/controlled-textarea-field";
import { apiClient } from "@/lib/config/api-client";
import { CONTACT } from "@/lib/shared/constants/endpoints";
import { contactFormSchema } from "@/lib/shared/schemas/contact.schema";
import { toast } from "@/lib/shared/utils/toast";

const SUPPORT_EMAIL = "support@pdfvault.ai";

export function ContactFormSection() {
  const form = useForm<ContactFormValues>({
    defaultValues: {
      email: "",
      firstName: "",
      lastName: "",
      message: "",
    },
    resolver: zodResolver(contactFormSchema),
  });

  const {
    formState: { isSubmitting },
    reset,
  } = form;

  const onSubmit = async (values: ContactFormValues) => {
    try {
      await apiClient.post(CONTACT.SUBMIT, values);
      toast.success({
        description: "Thanks — we'll reply within 24 hours.",
        title: "Message sent",
      });
      reset();
    } catch {
      toast.error({
        description: `Please try again or email us directly at ${SUPPORT_EMAIL}.`,
        title: "Couldn't send message",
      });
    }
  };

  return (
    <Form className="w-full space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
      <Fieldset className="gap-5">
        <Fieldset.Group className="gap-4 sm:grid sm:grid-cols-2 sm:gap-4">
          <ControlledInputField
            autoComplete="given-name"
            control={form.control}
            label="First name"
            name="firstName"
            placeholder="Jane"
          />
          <ControlledInputField
            autoComplete="family-name"
            control={form.control}
            label="Last name"
            name="lastName"
            placeholder="Doe"
          />
        </Fieldset.Group>
        <ControlledInputField
          autoComplete="email"
          control={form.control}
          label="Email address"
          name="email"
          placeholder="you@example.com"
          type="email"
        />
        <ControlledTextareaField
          control={form.control}
          label="Your message"
          name="message"
          placeholder="How can we help?"
          rows={6}
        />
        <Button isDisabled={isSubmitting} type="submit" variant="primary">
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
      </Fieldset>
    </Form>
  );
}

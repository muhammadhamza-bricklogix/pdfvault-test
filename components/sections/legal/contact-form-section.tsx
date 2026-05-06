"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Fieldset, Form } from "@heroui/react";
import { useForm } from "react-hook-form";

import { ControlledInputField } from "@/components/ui/form/controlled-input-field";
import { ControlledTextareaField } from "@/components/ui/form/controlled-textarea-field";
import type { ContactFormValues } from "@/lib/shared/schemas/contact.schema";
import { contactFormSchema } from "@/lib/shared/schemas/contact.schema";
import { toast } from "@/lib/shared/utils/toast";

const SUPPORT_EMAIL = "support@pdfeditsapp.com";

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

  const onSubmit = (values: ContactFormValues) => {
    const subject = encodeURIComponent(`Contact — ${values.firstName} ${values.lastName}`);
    const body = encodeURIComponent(
      `From: ${values.firstName} ${values.lastName}\nEmail: ${values.email}\n\n${values.message}`,
    );

    toast.success({
      description: `If nothing opens, reach us directly at ${SUPPORT_EMAIL}.`,
      title: "Opening your email app…",
    });
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
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
        <Button type="submit" variant="primary">
          Send message
        </Button>
      </Fieldset>
    </Form>
  );
}

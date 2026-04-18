"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldError, Input } from "@heroui/react";
import { Controller } from "react-hook-form";

type ControlledInputFieldProps<TFieldValues extends FieldValues> = {
  autoComplete?: string;
  control: Control<TFieldValues>;
  description?: string;
  externalError?: string | null;
  label: string;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
  type?: "email" | "password" | "text";
};

export function ControlledInputField<TFieldValues extends FieldValues>({
  autoComplete,
  control,
  description,
  externalError,
  label,
  name,
  placeholder,
  type = "text",
}: ControlledInputFieldProps<TFieldValues>) {
  const id = String(name);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const errorMessage = fieldState.error?.message ?? externalError;

        return (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor={id}>
              {label}
            </label>
            <Input
              ref={field.ref}
              aria-describedby={
                errorMessage
                  ? `${id}-error`
                  : description
                    ? `${id}-description`
                    : undefined
              }
              aria-invalid={Boolean(errorMessage)}
              autoComplete={autoComplete}
              className={`w-full rounded-2xl border bg-[var(--color-background)] px-4 py-3 outline-none transition ${
                errorMessage
                  ? "border-[var(--color-danger)]"
                  : "focus:border-[var(--color-accent)]"
              }`}
              id={id}
              name={field.name}
              placeholder={placeholder}
              type={type}
              value={typeof field.value === "string" ? field.value : ""}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {description ? (
              <p
                className="text-sm text-[var(--app-muted)]"
                id={`${id}-description`}
              >
                {description}
              </p>
            ) : null}
            {errorMessage ? (
              <FieldError
                className="text-sm text-[var(--color-danger)]"
                id={`${id}-error`}
              >
                {errorMessage}
              </FieldError>
            ) : null}
          </div>
        );
      }}
    />
  );
}

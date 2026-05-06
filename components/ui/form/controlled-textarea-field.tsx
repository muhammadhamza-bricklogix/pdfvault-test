"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { Description, FieldError, Label, TextField } from "@heroui/react";
import { Controller } from "react-hook-form";

type ControlledTextareaFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  description?: string;
  label: string;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
  rows?: number;
};

export function ControlledTextareaField<TFieldValues extends FieldValues>({
  control,
  description,
  label,
  name,
  placeholder,
  rows = 5,
}: ControlledTextareaFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField isInvalid={!!fieldState.error} name={field.name}>
          <Label>{label}</Label>
          <textarea
            ref={field.ref}
            className="min-h-[120px] w-full rounded-lg border border-default-200 bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] outline-none transition-colors placeholder:text-default-400 focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/20"
            placeholder={placeholder}
            rows={rows}
            value={typeof field.value === "string" ? field.value : ""}
            onBlur={field.onBlur}
            onChange={field.onChange}
          />
          {description && !fieldState.error && (
            <Description>{description}</Description>
          )}
          {fieldState.error?.message && (
            <FieldError>{fieldState.error.message}</FieldError>
          )}
        </TextField>
      )}
    />
  );
}

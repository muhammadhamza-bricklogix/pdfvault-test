"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { Controller } from "react-hook-form";

type ControlledInputFieldProps<TFieldValues extends FieldValues> = {
  autoComplete?: string;
  control: Control<TFieldValues>;
  description?: string;
  label: string;
  name: FieldPath<TFieldValues>;
  placeholder?: string;
  type?: "email" | "password" | "text";
};

export function ControlledInputField<TFieldValues extends FieldValues>({
  autoComplete,
  control,
  description,
  label,
  name,
  placeholder,
  type = "text",
}: ControlledInputFieldProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField isInvalid={!!fieldState.error} name={field.name}>
          <Label>{label}</Label>
          <Input
            ref={field.ref}
            autoComplete={autoComplete}
            placeholder={placeholder}
            type={type}
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

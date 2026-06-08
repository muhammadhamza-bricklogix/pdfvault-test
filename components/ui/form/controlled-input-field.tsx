"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { Controller } from "react-hook-form";

import { PasswordRevealToggle } from "./password-reveal-toggle";

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
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);
  // When the user toggles reveal, the actual rendered type swaps to `text` so
  // the browser displays the plaintext. The semantic "this field is for a
  // password" is preserved by `autoComplete="current-password"` / "new-password"
  // which the caller already passes through.
  const effectiveType = isPassword && revealed ? "text" : type;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField isInvalid={!!fieldState.error} name={field.name}>
          <Label>{label}</Label>
          {/*
            `relative w-full` makes the wrapper the positioning context for
            the absolute eye-toggle. HeroUI's Input is NOT full-width by
            default (see `.input--full-width` modifier in
            `@heroui/styles/dist/components/input.css:88-91`) — it only
            stretches when the `fullWidth` prop is set. Without that, the
            wrapper is wider than the input and the absolutely-positioned
            toggle would float past the input's right border, looking like
            it's hanging outside the field.
          */}
          <div className="relative w-full">
            <Input
              ref={field.ref}
              // Boolean shorthand must come before keyed props per the
              // project's `react/jsx-sort-props` rule.
              fullWidth
              autoComplete={autoComplete}
              // Leave room on the right for the toggle so long passwords
              // don't crash into the eye icon.
              className={isPassword ? "pr-10" : undefined}
              placeholder={placeholder}
              type={effectiveType}
              value={typeof field.value === "string" ? field.value : ""}
              onBlur={field.onBlur}
              onChange={field.onChange}
            />
            {isPassword && (
              <PasswordRevealToggle
                revealed={revealed}
                onToggle={() => setRevealed((v) => !v)}
              />
            )}
          </div>
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

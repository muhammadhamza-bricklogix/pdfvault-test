"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FieldError, InputOTP, REGEXP_ONLY_DIGITS } from "@heroui/react";
import { Controller } from "react-hook-form";

type ControlledOtpFieldProps<TFieldValues extends FieldValues> = {
  control: Control<TFieldValues>;
  externalError?: string | null;
  label: string;
  length?: number;
  name: FieldPath<TFieldValues>;
};

export function ControlledOtpField<TFieldValues extends FieldValues>({
  control,
  externalError,
  label,
  length = 6,
  name,
}: ControlledOtpFieldProps<TFieldValues>) {
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
            <div className="flex w-full justify-center overflow-x-auto p-1">
              <InputOTP
                aria-describedby={errorMessage ? `${id}-error` : undefined}
                aria-invalid={Boolean(errorMessage)}
                autoComplete="one-time-code"
                className="justify-center"
                id={id}
                inputMode="numeric"
                maxLength={length}
                name={field.name}
                pattern={REGEXP_ONLY_DIGITS}
                textAlign="center"
                value={typeof field.value === "string" ? field.value : ""}
                onBlur={field.onBlur}
                onChange={field.onChange}
              >
                <InputOTP.Group className="gap-2 sm:gap-3">
                  {Array.from({ length }).map((_, index) => (
                    <InputOTP.Slot
                      key={index}
                      className="h-14 w-11 flex-none rounded-2xl text-xl sm:w-12"
                      index={index}
                    />
                  ))}
                </InputOTP.Group>
              </InputOTP>
            </div>
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

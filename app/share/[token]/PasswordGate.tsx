"use client";

import { Button, Input, TextField } from "@heroui/react";
import { useState } from "react";

import { ViewerClient } from "./ViewerClient";

type PasswordGateProps = {
  bytesUrl: string;
  name: string;
  token: string;
};

export function PasswordGate({
  bytesUrl,
  name,
  token,
}: PasswordGateProps): React.ReactElement {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  if (unlocked) {
    return <ViewerClient bytesUrl={bytesUrl} name={name} token={token} />;
  }

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/share/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        cache: "no-store",
      });

      if (res.ok) {
        setUnlocked(true);

        return;
      }
      const body = (await res.json().catch(() => ({}))) as {
        reason?: string;
      };

      switch (body.reason) {
        case "bad-password":
          setError("Incorrect password.");
          break;
        case "rate-limited": {
          const retry = res.headers.get("Retry-After");

          setError(
            retry
              ? `Too many attempts. Try again in ${retry} seconds.`
              : "Too many attempts. Try again later.",
          );
          break;
        }
        case "expired":
          setError("This link has expired.");
          break;
        case "revoked":
          setError("This link has been revoked.");
          break;
        default:
          setError("Couldn't verify password. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6">
      <h1 className="mb-2 text-2xl font-semibold">Password required</h1>
      <p className="mb-6 text-center text-sm text-default-600">
        Enter the password to view{" "}
        <span className="font-medium text-foreground">{name}</span>.
      </p>
      <form className="flex w-full flex-col gap-3" onSubmit={onSubmit}>
        <TextField
          isDisabled={submitting}
          value={password}
          onChange={(v) => setPassword(v)}
        >
          <Input
            autoFocus
            aria-label="Password"
            placeholder="Password"
            type="password"
          />
        </TextField>
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button isDisabled={!password || submitting} type="submit">
          {submitting ? "Verifying…" : "View PDF"}
        </Button>
      </form>
    </main>
  );
}

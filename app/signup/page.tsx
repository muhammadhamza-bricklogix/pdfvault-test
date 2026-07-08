import { redirect } from "next/navigation";

/**
 * Legacy alias — auth lives at `/sign-up` (matches the platform config).
 * Any bookmark that still hits `/signup` gets forwarded, preserving the
 * `?redirect_url=` param when present.
 */
export default async function SignupAliasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const suffix = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") suffix.set(key, value);
  }
  const query = suffix.toString();

  redirect(`/sign-up${query ? `?${query}` : ""}`);
}

import { redirect } from "next/navigation";

export default async function PdfEditorAliasPage({
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

  redirect(`/pdf-composer${query ? `?${query}` : ""}`);
}

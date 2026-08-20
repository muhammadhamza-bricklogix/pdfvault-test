import { FormEditor } from "@/components/sections/forms/FormEditor";
import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";

export const metadata = {
  title: "Fill Out W-9 Form — PDFVault",
  description:
    "Fill out the IRS Form W-9 online in your browser. Type values, sign, and export a clean PDF.",
};

// Extended / short-URL entry point for the W-9 editor. Serves the same
// `FormEditor` as `/forms/w-9/edit` so bookmarks and shared links from
// either path load the same experience.
export default function W9ShortPage() {
  return <FormEditor formId="w-9" schema={W9_SCHEMA} />;
}

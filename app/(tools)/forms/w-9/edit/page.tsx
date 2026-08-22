import { FormEditor } from "@/components/sections/forms/FormEditor";
import { W9_SCHEMA } from "@/lib/client/forms/w9-schema";

export const metadata = {
  title: "Fill Out W-9 Form — Editor",
  description:
    "Fill out the IRS Form W-9 online in your browser. Type values, sign, and export a clean PDF.",
};

export default function W9EditPage() {
  return <FormEditor formId="w-9" schema={W9_SCHEMA} />;
}

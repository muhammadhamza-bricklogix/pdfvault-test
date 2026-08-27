import { redirect } from "next/navigation";

export default function SplitPdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=split");
}

import { redirect } from "next/navigation";

export default function UnlockPdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=unlock");
}

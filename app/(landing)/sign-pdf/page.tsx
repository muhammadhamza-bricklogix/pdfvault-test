import { redirect } from "next/navigation";

export default function SignPdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=sign");
}

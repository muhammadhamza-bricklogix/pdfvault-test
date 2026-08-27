import { redirect } from "next/navigation";

export default function PasswordProtectPdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=password");
}

import { redirect } from "next/navigation";

export default function RotatePdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=manage");
}

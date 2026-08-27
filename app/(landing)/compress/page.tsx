import { redirect } from "next/navigation";

export default function CompressLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=compress");
}

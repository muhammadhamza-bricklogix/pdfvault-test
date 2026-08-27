import { redirect } from "next/navigation";

export default function DeletePagesLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=manage");
}

import { redirect } from "next/navigation";

export default function RemoveAnnotationsLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=flatten");
}

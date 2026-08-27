import { redirect } from "next/navigation";

export default function ExtractImagesLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=extract-images");
}

import { redirect } from "next/navigation";

export default function WatermarkPdfLandingPage() {
  redirect("/pdf-composer?fresh=1&tool=watermark");
}

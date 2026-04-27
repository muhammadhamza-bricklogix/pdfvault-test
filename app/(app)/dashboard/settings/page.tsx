import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/shared/constants/routes";

export default function SettingsIndexPage() {
  redirect(ROUTES.APP.SETTINGS_GENERAL);
}

import type { Metadata } from "next";

import { BillingSettingsSection } from "@/components/sections/dashboard/settings/billing-settings-section";

export const metadata: Metadata = {
  title: "Billing — PDFVault",
};

export default function BillingSettingsPage() {
  return <BillingSettingsSection />;
}

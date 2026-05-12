import {
  SiAmericanexpress,
  SiMastercard,
  SiPaypal,
  SiVisa,
} from "react-icons/si";

import {
  footerPaymentIconClass,
  footerPaymentLogoSlotClass,
  footerPaymentStripClass,
} from "@/components/shared/footer/footer-styles";

const PAYMENT_BRANDS = [
  {
    Icon: SiVisa,
    label: "Visa",
    slotClass: "text-[#1434CB]",
  },
  {
    Icon: SiMastercard,
    label: "Mastercard",
    slotClass: "text-[#EB001B]",
  },
  {
    Icon: SiPaypal,
    label: "PayPal",
    slotClass: "text-[#003087]",
  },
  {
    Icon: SiAmericanexpress,
    label: "American Express",
    slotClass: "text-[#006FCF]",
  },
] as const;

export function FooterPaymentStrip() {
  return (
    <div
      aria-label="Accepted payment methods"
      className={footerPaymentStripClass}
      role="group"
    >
      {PAYMENT_BRANDS.map(({ Icon, label, slotClass }) => (
        <div
          key={label}
          className={`${footerPaymentLogoSlotClass} ${slotClass}`}
        >
          <Icon aria-hidden className={footerPaymentIconClass} title={label} />
        </div>
      ))}
    </div>
  );
}

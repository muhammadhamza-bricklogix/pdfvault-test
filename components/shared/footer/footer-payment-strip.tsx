import {
  SiAmericanexpress,
  SiMastercard,
  SiPaypal,
  SiVisa,
} from "react-icons/si";

import {
  footerPaymentIconClass,
  footerPaymentStripClass,
} from "@/components/shared/footer/footer-styles";

const PAYMENT_BRANDS = [
  { Icon: SiVisa, label: "Visa" },
  { Icon: SiMastercard, label: "Mastercard" },
  { Icon: SiPaypal, label: "PayPal" },
  { Icon: SiAmericanexpress, label: "American Express" },
] as const;

export function FooterPaymentStrip() {
  return (
    <div
      aria-label="Accepted payment methods"
      className={footerPaymentStripClass}
      role="group"
    >
      {PAYMENT_BRANDS.map(({ Icon, label }) => (
        <Icon
          key={label}
          aria-hidden
          className={footerPaymentIconClass}
          title={label}
        />
      ))}
    </div>
  );
}

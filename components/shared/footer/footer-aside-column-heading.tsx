import type { FooterAsideColumnIcon } from "@/lib/shared/constants/footer";

import { AccountSetting02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import {
  footerAsideColumnTitleClass,
  footerSubsectionIconWrapClass,
} from "@/components/shared/footer/footer-styles";

const ASIDE_ICONS = {
  account: AccountSetting02Icon,
  help: Mail01Icon,
} as const;

type FooterAsideColumnHeadingProps = {
  asideIcon: FooterAsideColumnIcon;
  title: string;
};

export function FooterAsideColumnHeading({
  asideIcon,
  title,
}: FooterAsideColumnHeadingProps) {
  const Icon = ASIDE_ICONS[asideIcon];

  return (
    <h3 className={footerAsideColumnTitleClass}>
      <span className={footerSubsectionIconWrapClass}>
        <HugeiconsIcon aria-hidden icon={Icon} size={18} />
      </span>
      <span>{title}</span>
    </h3>
  );
}

"use client";

import { Button } from "@heroui/react";

type OAuthButtonProps = {
  icon: React.ReactNode;
  isDisabled?: boolean;
  label: string;
  onPress: () => void;
};

export function OAuthButton({
  icon,
  isDisabled,
  label,
  onPress,
}: OAuthButtonProps) {
  return (
    <Button
      className="w-full gap-3 rounded-2xl"
      isDisabled={isDisabled}
      variant="outline"
      onPress={onPress}
    >
      {icon}
      {label}
    </Button>
  );
}

const GOOGLE_ICON_URL =
  "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/google/default.svg";

export function GoogleLogo({ size = 20 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt="Google" height={size} src={GOOGLE_ICON_URL} width={size} />;
}

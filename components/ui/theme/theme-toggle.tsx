"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useTheme } from "next-themes";

type ThemeToggleProps = {
  size?: "sm" | "md";
  variant?: "ghost" | "tertiary";
};

export function ThemeToggle({
  size = "md",
  variant = "ghost",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();

  const isDarkMode = resolvedTheme === "dark";
  const label = isDarkMode ? "Switch to light mode" : "Switch to dark mode";

  return (
    <Tooltip delay={300}>
      <Button
        isIconOnly
        aria-label={label}
        className="rounded-full"
        size={size}
        type="button"
        variant={variant}
        onPress={() => setTheme(isDarkMode ? "light" : "dark")}
      >
        <HugeiconsIcon
          icon={isDarkMode ? Sun03Icon : Moon02Icon}
          size={size === "sm" ? 16 : 18}
        />
      </Button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

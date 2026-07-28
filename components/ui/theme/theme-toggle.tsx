"use client";

import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, Tooltip } from "@heroui/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeToggleProps = {
  size?: "sm" | "md";
  variant?: "ghost" | "tertiary";
};

export function ThemeToggle({
  size = "md",
  variant = "ghost",
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Mount guard: defer the icon swap to the client so SSR ("Switch to dark mode"
    // / moon icon) matches the first client render before next-themes resolves
    // localStorage and we flip to the sun.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Temporarily hidden while the app is forced-light (see
  // app/layout.tsx `forcedTheme: "light"`). Toggling has no visual effect
  // under a forced theme. Placed AFTER all hook calls to satisfy
  // rules-of-hooks. Remove this early return when re-enabling dark mode
  // alongside removing `forcedTheme` from the layout.

  if (true) return null;

  const isDarkMode = mounted && resolvedTheme === "dark";
  const label = isDarkMode ? "Switch to light mode" : "Switch to dark mode";
  const iconSize = size === "sm" ? 16 : 18;

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
        {mounted ? (
          <HugeiconsIcon
            icon={isDarkMode ? Sun03Icon : Moon02Icon}
            size={iconSize}
          />
        ) : (
          <span
            aria-hidden="true"
            style={{
              display: "inline-block",
              height: iconSize,
              width: iconSize,
            }}
          />
        )}
      </Button>
      <Tooltip.Content>
        <p>{label}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}

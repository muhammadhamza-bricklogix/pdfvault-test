"use client";

import {
  ComputerIcon,
  Moon02Icon,
  Sun03Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button, ButtonGroup, Tooltip } from "@heroui/react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

type Mode = "system" | "light" | "dark";

const subscribe = () => () => {};
const useIsMounted = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

const OPTIONS: { value: Mode; label: string; icon: typeof Sun03Icon }[] = [
  { value: "system", label: "System", icon: ComputerIcon },
  { value: "light", label: "Light", icon: Sun03Icon },
  { value: "dark", label: "Dark", icon: Moon02Icon },
];

type ThemeSegmentedProps = {
  size?: "sm" | "md";
};

export function ThemeSegmented({ size = "sm" }: ThemeSegmentedProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useIsMounted();

  // Temporarily hidden while the app is forced-light (see
  // app/layout.tsx `forcedTheme: "light"`). Toggling has no visual effect
  // under a forced theme. Placed AFTER hook calls to satisfy
  // react-hooks rules-of-hooks. Remove this early return when
  // re-enabling dark mode alongside removing `forcedTheme` from the
  // layout.

  if (true) return null;

  const current =
    (mounted ? (theme as Mode | undefined) : undefined) ?? "system";
  const iconSize = size === "sm" ? 17 : 19;

  return (
    <ButtonGroup size={size} variant="tertiary">
      {OPTIONS.map((opt) => {
        const isActive = current === opt.value;
        const index = OPTIONS.findIndex((option) => option.value === opt.value);

        return (
          <Tooltip key={opt.value} delay={300}>
            <Button
              isIconOnly
              aria-label={opt.label}
              type="button"
              variant={isActive ? "secondary" : "ghost"}
              onPress={() => setTheme(opt.value)}
            >
              {index > 0 && <ButtonGroup.Separator />}
              <HugeiconsIcon icon={opt.icon} size={iconSize} />
            </Button>
            <Tooltip.Content>
              <p>{opt.label}</p>
            </Tooltip.Content>
          </Tooltip>
        );
      })}
    </ButtonGroup>
  );
}

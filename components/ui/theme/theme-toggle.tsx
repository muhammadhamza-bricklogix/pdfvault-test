"use client";

import { Button } from "@heroui/react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const isDarkMode = resolvedTheme === "dark";

  return (
    <Button
      className="min-w-24 rounded-full"
      type="button"
      variant="ghost"
      onPress={() => setTheme(isDarkMode ? "light" : "dark")}
    >
      {isDarkMode ? "Light mode" : "Dark mode"}
    </Button>
  );
}

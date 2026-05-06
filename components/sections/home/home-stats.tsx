import {
  FileEditIcon,
  SignatureIcon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const STATS = [
  {
    icon: FileEditIcon,
    label: "Documents edited",
    value: "1.9 Million",
  },
  {
    icon: UserCircleIcon,
    label: "Editing Essentials",
    value: "50+ Tools",
  },
  {
    icon: SignatureIcon,
    label: "Documents signed",
    value: "232k",
  },
] as const;

export function HomeStats() {
  return (
    <div className="flex w-full max-w-3xl flex-col items-stretch justify-center gap-10 sm:flex-row sm:flex-wrap sm:gap-12 lg:gap-14">
      {STATS.map((item) => (
        <div
          key={item.value}
          className="flex flex-1 flex-col items-center gap-2 sm:min-w-[9.5rem]"
        >
          <div className="flex size-12 items-center justify-center rounded-lg border-2 border-[color-mix(in_oklab,var(--color-accent)_55%,var(--color-background))] bg-[var(--color-background)]">
            <HugeiconsIcon
              className="text-[var(--color-accent)]"
              icon={item.icon}
              size={24}
            />
          </div>
          <p className="text-center text-xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-2xl">
            {item.value}
          </p>
          <p className="text-center text-sm font-medium text-default-600 dark:text-default-400">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

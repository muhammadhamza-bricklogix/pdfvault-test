"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Accordion } from "@heroui/react";

export type NecFaqEntry = {
  id: string;
  question: string;
  answer: string;
};

type NecFaqProps = {
  items: NecFaqEntry[];
};

export function NecFaq({ items }: NecFaqProps) {
  return (
    <Accordion
      hideSeparator
      className="flex w-full flex-col gap-3"
      variant="default"
    >
      {items.map((item) => (
        <Accordion.Item
          key={item.id}
          className="overflow-hidden rounded-2xl border border-default-200 bg-[var(--color-background)] shadow-sm dark:border-default-700"
          id={item.id}
        >
          <Accordion.Heading>
            <Accordion.Trigger className="flex w-full items-center justify-between gap-4 px-5 py-4 text-start hover:bg-default-50 dark:hover:bg-default-50/10">
              <span className="text-base font-semibold text-[var(--color-foreground)]">
                {item.question}
              </span>
              <Accordion.Indicator className="shrink-0 text-default-400 transition-transform duration-200 data-[expanded=true]:rotate-90">
                <HugeiconsIcon icon={ArrowRight01Icon} size={18} />
              </Accordion.Indicator>
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            <Accordion.Body className="px-5 pb-4 pt-0 text-sm leading-relaxed text-default-600 dark:text-default-400">
              {item.answer}
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

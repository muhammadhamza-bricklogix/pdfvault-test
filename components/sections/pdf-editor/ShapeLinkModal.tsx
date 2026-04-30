"use client";

import type { Key } from "react";

import { Button, Modal, Tabs } from "@heroui/react";
import { useState } from "react";
import { z } from "zod";

type LinkTab = "email" | "url";

type ShapeLinkModalProps = {
  initialValue: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
};

const emailSchema = z.string().trim().email("Enter a valid email address");
const urlSchema = z.string().trim().url("Enter a valid URL");

function detectTab(value: string): LinkTab {
  return value.startsWith("mailto:") ? "email" : "url";
}

function displayValue(value: string, tab: LinkTab) {
  if (tab === "email" && value.startsWith("mailto:")) {
    return value.slice("mailto:".length);
  }

  return value;
}

function ShapeLinkModalContent({
  initialValue,
  onClose,
  onSave,
}: Omit<ShapeLinkModalProps, "isOpen">) {
  const initialTab = detectTab(initialValue);
  const [activeTab, setActiveTab] = useState<LinkTab>(initialTab);
  const [value, setValue] = useState(displayValue(initialValue, initialTab));

  const validation =
    activeTab === "url"
      ? urlSchema.safeParse(value)
      : emailSchema.safeParse(value);
  const error =
    value && !validation.success ? validation.error.issues[0]?.message : "";

  const handleTabChange = (key: Key) => {
    setActiveTab(key as LinkTab);
    setValue("");
  };

  const handleSave = () => {
    if (!validation.success) return;

    onSave(
      activeTab === "email" ? `mailto:${validation.data}` : validation.data,
    );
    onClose();
  };

  return (
    <div className="space-y-5 p-1">
      <h2 className="text-lg font-semibold text-[var(--color-foreground)]">
        Link
      </h2>

      <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Link type">
            <Tabs.Tab id="url">
              URL
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="email">
              <Tabs.Separator />
              Email
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel className="pt-4" id="url">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              Enter a URL
            </span>
            <input
              autoFocus
              aria-invalid={!!error}
              className="h-11 rounded-lg bg-default-100 px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-default-500 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              placeholder="https://example.com"
              type="url"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        </Tabs.Panel>

        <Tabs.Panel className="pt-4" id="email">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[var(--color-foreground)]">
              Enter an email
            </span>
            <input
              autoFocus
              aria-invalid={!!error}
              className="h-11 rounded-lg bg-default-100 px-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-default-500 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              placeholder="name@example.com"
              type="email"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </label>
        </Tabs.Panel>
      </Tabs>

      <p className="min-h-5 text-xs text-danger">{error}</p>

      <div className="flex gap-3">
        <Button
          className="flex-1"
          isDisabled={!initialValue}
          variant="outline"
          onPress={() => {
            onSave("");
            onClose();
          }}
        >
          Delete link
        </Button>
        <Button
          className="flex-1"
          isDisabled={!validation.success}
          variant="primary"
          onPress={handleSave}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

export function ShapeLinkModal({
  initialValue,
  isOpen,
  onClose,
  onSave,
}: ShapeLinkModalProps) {
  return (
    <Modal>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
      >
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-[420px]">
            <Modal.CloseTrigger />
            <ShapeLinkModalContent
              key={`${isOpen}:${initialValue}`}
              initialValue={initialValue}
              onClose={onClose}
              onSave={onSave}
            />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

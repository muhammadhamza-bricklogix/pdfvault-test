"use client";

import { Button, Modal } from "@heroui/react";
import { useState } from "react";

type Props = {
  filename: string | null;
  onIgnore: () => void;
  onOverwrite: () => void;
};

export function DuplicateUploadModal({
  filename,
  onIgnore,
  onOverwrite,
}: Props) {
  const isOpen = !!filename;
  // Keep body text mounted through the close animation; removing Weglot-rewritten nodes crashes React.
  const [shownFilename, setShownFilename] = useState(filename);

  if (filename && filename !== shownFilename) setShownFilename(filename);

  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onIgnore();
      }}
    >
      <Modal.Container>
        <Modal.Dialog className="sm:max-w-[440px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>This file already exists</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm text-default-500">
              {shownFilename ? (
                <>
                  A document named{" "}
                  <span className="font-medium text-[var(--color-foreground)]">
                    {shownFilename}
                  </span>{" "}
                  already exists in your library. Overwrite it with the new
                  upload, or ignore this upload to keep your existing file.
                </>
              ) : null}
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onIgnore}>
              Ignore
            </Button>
            <Button onPress={onOverwrite}>Overwrite</Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

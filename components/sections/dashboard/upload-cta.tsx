"use client";

import { Upload01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

import { useUploadDocumentMutation } from "@/lib/client/query/mutations/documents.mutation";
import { ROUTES } from "@/lib/shared/constants/routes";
import { usePdfEditorStore } from "@/lib/client/stores/pdf-editor-store";

export function UploadCta() {
    const inputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const upload = useUploadDocumentMutation();
    const setFile = usePdfEditorStore((s) => s.setFile);
    const setCurrentDocument = usePdfEditorStore((s) => s.setCurrentDocument);

    const onPick = () => inputRef.current?.click();

    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];

        e.target.value = "";
        if (!file) return;

        const doc = await upload.mutateAsync({ file });

        setFile(file);
        setCurrentDocument({ id: doc.id, name: doc.filename });
        router.push(`${ROUTES.TOOLS.PDF_EDITOR}?id=${doc.id}`);
    };

    return (
        <>
            <input
                ref={inputRef}
                accept="application/pdf"
                className="hidden"
                type="file"
                onChange={onChange}
            />
            <Button isDisabled={upload.isPending} onPress={onPick}>
                <HugeiconsIcon icon={Upload01Icon} size={16} />
                {upload.isPending ? "Uploading..." : "Upload PDF"}
            </Button>
        </>
    );
}

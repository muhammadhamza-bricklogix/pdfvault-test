export type ToolConfig = {
  accept: string[];
  acceptLabel: string;
  description: string;
  outputFormat: string;
  slug: string;
  title: string;
};

export const TOOLS: Record<string, ToolConfig> = {
  "pdf-to-excel": {
    slug: "pdf-to-excel",
    title: "PDF to Excel",
    description: "Convert PDF documents to Excel spreadsheets.",
    accept: ["application/pdf"],
    acceptLabel: "PDF",
    outputFormat: "xlsx",
  },
  "excel-to-pdf": {
    slug: "excel-to-pdf",
    title: "Excel to PDF",
    description: "Convert Excel spreadsheets to PDF documents.",
    accept: [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    acceptLabel: "Excel (.xls, .xlsx)",
    outputFormat: "pdf",
  },
  "doc-to-pdf": {
    slug: "doc-to-pdf",
    title: "DOC to PDF",
    description: "Convert Word documents to PDF.",
    accept: [
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
    acceptLabel: "Word (.doc, .docx)",
    outputFormat: "pdf",
  },
  "pdf-to-doc": {
    slug: "pdf-to-doc",
    title: "PDF to DOC",
    description: "Convert PDF documents to editable Word files.",
    accept: ["application/pdf"],
    acceptLabel: "PDF",
    outputFormat: "docx",
  },
} as const;

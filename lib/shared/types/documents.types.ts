export type Document = {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type DocumentListResponse = Paginated<Document>;

export type DocumentListParams = {
  page: number;
  pageSize: number;
};

export type UploadDocumentInput = {
  file: File | Blob;
  /** When provided, updates an existing document. Otherwise creates a new one. */
  id?: string;
  /** Override filename when sending a Blob without a name. */
  fileName?: string;
};

export type RenameDocumentInput = {
  id: string;
  name: string;
};

export type DownloadResponse = {
  url: string;
  expiresAt: string;
};

/** Standard success envelope returned by the API for non-204 responses. */
export type ApiResponse<T> = {
  success: true;
  message: string;
  data: T;
};

/** Standard error envelope returned for failed requests. */
export type ApiErrorResponse = {
  success: false;
  message: string;
  statusCode: number;
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Paginated<T> = {
  items: T[];
  pagination: Pagination;
};

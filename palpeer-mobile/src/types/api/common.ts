/** Backend `ApiResponse<T>` envelope (palpeer-common). */
export type ApiEnvelope<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: ApiErrorBody;
  timestamp: string;
};

export type ApiViolation = {
  field: string;
  message: string;
};

export type ApiErrorBody = {
  code: string;
  detail?: string;
  violations?: ApiViolation[];
};

/** Spring Data `Page<T>`; only the stable fields are typed. */
export type SpringPage<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
};

export type PageParams = {
  page?: number;
  size?: number;
  sort?: string;
};

export type Uuid = string;
export type IsoInstant = string;

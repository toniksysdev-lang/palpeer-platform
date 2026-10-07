export type ApiErrorBody = {
  code?: string;
  detail?: string;
  violations?: Array<{ field?: string; message?: string }>;
};

export type ApiResponse<T> = {
  success: boolean;
  message?: string | null;
  data?: T | null;
  error?: ApiErrorBody | null;
  timestamp?: string;
};

export type AuthTokens = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  tokenType: string;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(status: number, code: string, message: string, detail?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

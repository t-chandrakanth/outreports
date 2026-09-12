import type { ApiErrorCode } from '../types';

/** Server said no. Terminal unless code is BUSY. */
export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
  get retryable(): boolean {
    return this.code === 'BUSY';
  }
}

/** Could not reach the server at all (offline, DNS, timeout). Retryable. */
export class NetworkError extends Error {}

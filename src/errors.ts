/**
 * KITE SDK errors – graceful, consistent error handling.
 */

export interface KiteApiErrorDetails {
  /** HTTP status code from the API */
  statusCode: number;
  /** Error message from the API or a safe fallback */
  message: string;
  /** Optional error code or type */
  code?: string;
  /** Raw response body when available (for debugging, not for display) */
  raw?: unknown;
}

/**
 * Thrown when the KITE API returns an error (4xx/5xx or success: false).
 * Use statusCode and message for user-facing handling.
 */
export class KiteApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly raw?: unknown;

  constructor(details: KiteApiErrorDetails) {
    super(details.message);
    this.name = 'KiteApiError';
    this.statusCode = details.statusCode;
    this.code = details.code;
    this.raw = details.raw;
    Object.setPrototypeOf(this, KiteApiError.prototype);
  }

  /** Whether this is a client error (4xx) */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /** Whether this is a server error (5xx) */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /** Whether this is an auth error (401/403) */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /** Whether this is not found (404) */
  isNotFound(): boolean {
    return this.statusCode === 404;
  }
}

/**
 * Thrown when the request fails before reaching the API (network, timeout, etc.).
 */
export class KiteNetworkError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'KiteNetworkError';
    this.cause = cause;
    Object.setPrototypeOf(this, KiteNetworkError.prototype);
  }
}

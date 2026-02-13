/**
 * Low-level HTTP client for KITE Custody Orchestrator.
 * Handles timeout, headers, and normalizes errors into KiteApiError or KiteNetworkError.
 */

import type { ApiResponse } from './types';
import { KiteApiError } from './errors';
import { KiteNetworkError } from './errors';
import type { LogLevel } from './types';

export interface RequestConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  logLevel: LogLevel;
  log: (level: LogLevel, message: string) => void;
}

function safeJsonParse<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

export async function request<T>(
  config: RequestConfig,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
  };

  const init: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body !== undefined && body !== null && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  config.log('debug', `${method} ${url}`);

  let response: Response;
  let responseText: string;

  try {
    response = await fetch(url, init);
    responseText = await response.text();
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError';
    const message = isAbort
      ? `Request timed out after ${config.timeout}ms`
      : err?.message || 'Network request failed';
    config.log('error', message);
    throw new KiteNetworkError(message, err);
  }

  clearTimeout(timeoutId);

  const data = safeJsonParse<ApiResponse<T>>(responseText);
  const statusCode = response.status;

  if (!response.ok) {
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      response.statusText ||
      `Request failed with status ${statusCode}`;
    config.log('warn', `${statusCode} ${path}: ${message}`);
    throw new KiteApiError({
      statusCode,
      message,
      raw: data ?? responseText,
    });
  }

  if (data && data.success === false) {
    const message = typeof data.error === 'string' ? data.error : 'Request failed';
    config.log('warn', `${statusCode} ${path}: ${message}`);
    throw new KiteApiError({
      statusCode: data.status ?? statusCode,
      message,
      raw: data,
    });
  }

  // Success: return data or data.data depending on API shape
  if (data && typeof data === 'object' && 'data' in data) {
    return (data.data as T) ?? (data as unknown as T);
  }
  return (data as T) ?? ({} as T);
}

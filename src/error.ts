import { isRecord } from './json';

export class MoreflowFormError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly retryable: boolean;
  readonly responseBody: unknown;

  constructor(options: {
    message: string;
    status?: number | undefined;
    code?: string | undefined;
    retryable?: boolean | undefined;
    responseBody?: unknown;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = 'MoreflowFormError';
    this.status = options.status;
    this.code = options.code;
    this.retryable = options.retryable ?? false;
    this.responseBody = options.responseBody;
  }
}

export function retryableStatus(status: number): boolean {
  return status === 425 || status === 429 || status >= 500;
}

export async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.clone().text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Extracts the navigational error code from a Moreflow API error body. Handles
 * both server shapes: operation failures (`{ error: { code } }`) and
 * route-level errors (`{ code }`).
 */
export function serverErrorCode(body: unknown): string | undefined {
  if (!isRecord(body)) return undefined;
  if (typeof body.code === 'string' && body.code) return body.code;
  if (isRecord(body.error) && typeof body.error.code === 'string' && body.error.code)
    return body.error.code;
  return undefined;
}

/**
 * Extracts the human-readable server message from a Moreflow API error body
 * (`message`, `error` as a string, or `error.message`).
 */
export function serverErrorMessage(body: unknown): string | undefined {
  if (isRecord(body)) {
    if (typeof body.message === 'string' && body.message) return body.message;
    if (typeof body.error === 'string' && body.error) return body.error;
    if (isRecord(body.error) && typeof body.error.message === 'string' && body.error.message)
      return body.error.message;
  }
  return undefined;
}

/**
 * Returns the best human-readable message for a caught form helper error, so
 * embeds do not have to dig through `MoreflowFormError.responseBody` shapes
 * themselves. Falls back to `fallback` when nothing usable is found.
 */
export function formErrorMessage(
  error: unknown,
  fallback = 'The form request failed. Please try again.'
): string {
  if (error instanceof MoreflowFormError) {
    const fromBody = serverErrorMessage(error.responseBody);
    if (fromBody) return fromBody;
    if (typeof error.responseBody === 'string' && error.responseBody.length > 0)
      return error.responseBody.slice(0, 240);
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

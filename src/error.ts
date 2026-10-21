import { type LocalizedFormErrorOptions, localizedFormErrorMessage } from './error-messages';
import {
  type MoreflowClientErrorCode,
  type MoreflowErrorInit,
  MoreflowSdkError,
  serverErrorFields
} from './internal/errors';

export type { MoreflowClientErrorCode, MoreflowErrorRecovery } from './internal/errors';

/**
 * Codes a `MoreflowFormError` carries: the SDK's own codes and the codes the
 * public form endpoints return. A newer server may send codes not listed here.
 */
export type FormErrorCode =
  | MoreflowClientErrorCode
  /** `headers` or `token` contain a value `Headers` rejects. */
  | 'INVALID_SUBMISSION_HEADERS'
  /** The phone number cannot be parsed for verification. */
  | 'INVALID_PHONE_NUMBER'
  /** The verification code is wrong or blank; let the visitor retype it. */
  | 'INVALID_VERIFICATION_CODE'
  /** The verification challenge expired; start a new one. */
  | 'VERIFICATION_PROOF_EXPIRED'
  /** The verification proof was already used; start a new one. */
  | 'VERIFICATION_PROOF_REPLAYED'
  /** The form response has no pages or no form id. */
  | 'INVALID_FORM_DEFINITION'
  /** Turnstile cannot load here (no browser, or the script failed). */
  | 'TURNSTILE_UNAVAILABLE'
  /** The form id is unknown, or the form belongs to no account. */
  | 'FORM_NOT_FOUND'
  /** The form was archived. */
  | 'FORM_RETIRED'
  /** The form has no published version. */
  | 'FORM_UNPUBLISHED'
  /** The page's origin is not in the form's allowed domains. */
  | 'ORIGIN_NOT_ALLOWED'
  /** Required fields are missing; `details.missingFieldIds` lists them (see `missingFieldIdsFromError`). */
  | 'VALIDATION_ERROR'
  /** The request body is not a JSON object with a `data` object. */
  | 'INVALID_SUBMISSION'
  /** The honeypot field was filled. */
  | 'SPAM_REJECTED'
  /** Turnstile is enforced and no token was sent. */
  | 'ANTI_SPAM_REQUIRED'
  /** Turnstile rejected the token; reset the widget and let the visitor retry. */
  | 'ANTI_SPAM_INVALID'
  /** The idempotency key was reused with a different payload. */
  | 'IDEMPOTENCY_CONFLICT'
  /** The verification challenge is unknown or belongs to another number. */
  | 'INVALID_VERIFICATION_PROOF'
  /** Too many requests; retryable after `Retry-After`. */
  | 'RATE_LIMIT'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  /** The SMS provider failed. */
  | 'PROVIDER_ERROR'
  | 'INTERNAL_ERROR';

/** The error every `@moreflow/forms` helper throws. */
export class MoreflowFormError extends MoreflowSdkError<FormErrorCode> {
  constructor(init: MoreflowErrorInit) {
    super(init);
    this.name = 'MoreflowFormError';
  }
}

/**
 * Extracts the navigational error code from a Moreflow API error body. Handles
 * the public `{ error: { code } }`, operation failures and route-level `{ code }`.
 */
export function serverErrorCode(body: unknown): string | undefined {
  return serverErrorFields(body).code;
}

/**
 * Extracts the human-readable server message from a Moreflow API error body
 * (`error.message`, `message`, or `error` as a string).
 */
export function serverErrorMessage(body: unknown): string | undefined {
  return serverErrorFields(body).message;
}

/**
 * The required field ids a `VALIDATION_ERROR` submission failure names
 * (`details.missingFieldIds`); empty for any other error.
 */
export function missingFieldIdsFromError(error: unknown): string[] {
  if (!(error instanceof MoreflowFormError) || error.code !== 'VALIDATION_ERROR') return [];
  const ids = error.details.missingFieldIds;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
}

/**
 * `language`, `formality` and `messages.errors` choose the copy; `fallback`
 * is shown for errors without known copy.
 */
export type FormErrorMessageOptions = LocalizedFormErrorOptions;

/**
 * Returns the message to show for a caught form helper error.
 *
 * With options (`formErrorMessage(error, { language: 'de' })`) it returns
 * visitor-facing copy for the error's `code` in German ("Sie" or, with
 * `formality: 'informal'`, "du") or English, or your `messages.errors` text,
 * and never the server's English developer message.
 *
 * With a string or nothing as the second argument it keeps its original
 * behavior: the server's raw message from `MoreflowFormError.responseBody`,
 * else the error message, else `fallback`.
 */
export function formErrorMessage(
  error: unknown,
  fallbackOrOptions?: string | FormErrorMessageOptions
): string {
  if (typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null) {
    return localizedFormErrorMessage(error, fallbackOrOptions);
  }
  const fallback = fallbackOrOptions ?? 'The form request failed. Please try again.';
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

import type { CountryCode } from 'libphonenumber-js';
import { MoreflowFormError } from './error';
import {
  abortedErrorInit,
  fetchUnavailableInit,
  networkErrorInit,
  operationErrorInit,
  validationErrorInit
} from './internal/errors';
import { readResponseBody, resolveBaseUrl, resolveFetch } from './internal/http';
import { isRecord } from './internal/values';
import { normalizePhoneNumber } from './phone';

export interface PhoneVerificationRequestOptions {
  formId: string;
  /** Raw phone input; normalized to E.164 with `defaultCountry` before sending. */
  phoneNumber: string;
  defaultCountry?: CountryCode | undefined;
  /**
   * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
   * to call your page's own origin behind a same-origin proxy.
   */
  baseUrl?: string | undefined;
  /** Sends `Authorization: Bearer <token>` with the request. */
  token?: string | undefined;
  /** Additional request headers. */
  headers?: Record<string, string> | undefined;
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}

export interface PhoneVerificationChallenge {
  challengeId: string;
  /** The E.164 number the code was sent to; pass it unchanged to the check and the submission. */
  phoneNumber: string;
  expiresAt?: string | undefined;
}

export interface CheckPhoneVerificationOptions extends PhoneVerificationRequestOptions {
  challengeId: string;
  code: string;
}

export interface PhoneVerificationResult {
  verified: true;
  phoneNumber: string;
}

function normalizedVerificationPhone(options: PhoneVerificationRequestOptions): string {
  const phone = normalizePhoneNumber(options.phoneNumber, {
    defaultCountry: options.defaultCountry
  });
  if (phone.status !== 'valid') {
    throw new MoreflowFormError({
      message:
        phone.status === 'empty'
          ? 'A phone number is required for verification.'
          : 'The phone number is not a valid phone number.',
      code: 'INVALID_PHONE_NUMBER',
      retryable: false
    });
  }
  return phone.e164;
}

async function phoneVerificationRequest(
  options: PhoneVerificationRequestOptions,
  method: 'PUT' | 'POST',
  body: Record<string, unknown>,
  failureMessage: string
): Promise<unknown> {
  if (!options.formId.trim()) {
    throw new MoreflowFormError(validationErrorInit('formId', 'formId is required.'));
  }
  const fetchImpl = resolveFetch(options.fetchImpl);
  if (!fetchImpl) throw new MoreflowFormError(fetchUnavailableInit('@moreflow/forms'));

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  const url = `${resolveBaseUrl({ baseUrl: options.baseUrl })}/v1/forms/${encodeURIComponent(options.formId)}/phone-verification`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method,
      headers,
      body: JSON.stringify(body),
      ...(options.signal ? { signal: options.signal } : {})
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw new MoreflowFormError(abortedErrorInit(`${failureMessage}: aborted.`, options.signal));
    }
    throw new MoreflowFormError(
      networkErrorInit(`${failureMessage} before a response was received.`, error)
    );
  }

  const responseBody = await readResponseBody(response);
  if (!response.ok) {
    throw new MoreflowFormError(
      operationErrorInit({ responseBody, status: response.status, fallbackMessage: failureMessage })
    );
  }
  return responseBody;
}

/**
 * Starts phone verification for a form whose phone field requires it
 * (`PUT /v1/forms/{formId}/phone-verification`). The server texts a code to
 * the number and returns a challenge id for {@link checkPhoneVerification}.
 *
 * Each call sends a real SMS, so the helper never retries by itself; inspect
 * `MoreflowFormError.retryable` before resending.
 */
export async function sendPhoneVerification(
  options: PhoneVerificationRequestOptions
): Promise<PhoneVerificationChallenge> {
  const phoneNumber = normalizedVerificationPhone(options);
  const body = await phoneVerificationRequest(
    options,
    'PUT',
    { phoneNumber },
    'Moreflow phone verification could not be started'
  );
  const challengeId =
    isRecord(body) && typeof body.challengeId === 'string' ? body.challengeId : '';
  if (!challengeId) {
    throw new MoreflowFormError({
      message: 'Moreflow phone verification did not return a challenge id.',
      code: 'INVALID_RESPONSE',
      retryable: false,
      responseBody: body
    });
  }
  return {
    challengeId,
    phoneNumber,
    ...(isRecord(body) && typeof body.expiresAt === 'string' ? { expiresAt: body.expiresAt } : {})
  };
}

/**
 * Checks the code the visitor received (`POST /v1/forms/{formId}/phone-verification`).
 * Resolves with the verified E.164 number, or throws `MoreflowFormError` — commonly
 * `INVALID_VERIFICATION_CODE` (let the visitor retype), `VERIFICATION_PROOF_EXPIRED`
 * or `VERIFICATION_PROOF_REPLAYED` (start a new challenge with
 * {@link sendPhoneVerification}).
 */
export async function checkPhoneVerification(
  options: CheckPhoneVerificationOptions
): Promise<PhoneVerificationResult> {
  const phoneNumber = normalizedVerificationPhone(options);
  const code = options.code.trim();
  if (!code) {
    throw new MoreflowFormError({
      message: 'A verification code is required.',
      code: 'INVALID_VERIFICATION_CODE',
      retryable: false
    });
  }
  await phoneVerificationRequest(
    options,
    'POST',
    { phoneNumber, code, challengeId: options.challengeId },
    'Moreflow phone verification could not be checked'
  );
  return { verified: true, phoneNumber };
}

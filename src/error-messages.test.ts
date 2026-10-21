import { describe, expect, it } from 'vitest';
import { type FormErrorCode, formErrorMessage, MoreflowFormError } from './index';

// Every code `FormErrorCode` names; the record type fails to compile when one is missing.
const everyCode: Record<FormErrorCode, true> = {
  ABORTED: true,
  NETWORK_ERROR: true,
  FETCH_UNAVAILABLE: true,
  VALIDATION_ERROR: true,
  INVALID_RESPONSE: true,
  REQUEST_FAILED: true,
  INVALID_SUBMISSION_HEADERS: true,
  INVALID_PHONE_NUMBER: true,
  INVALID_VERIFICATION_CODE: true,
  VERIFICATION_PROOF_EXPIRED: true,
  VERIFICATION_PROOF_REPLAYED: true,
  INVALID_FORM_DEFINITION: true,
  TURNSTILE_UNAVAILABLE: true,
  FORM_NOT_FOUND: true,
  FORM_RETIRED: true,
  FORM_UNPUBLISHED: true,
  ORIGIN_NOT_ALLOWED: true,
  INVALID_SUBMISSION: true,
  SPAM_REJECTED: true,
  ANTI_SPAM_REQUIRED: true,
  ANTI_SPAM_INVALID: true,
  IDEMPOTENCY_CONFLICT: true,
  INVALID_VERIFICATION_PROOF: true,
  RATE_LIMIT: true,
  FORBIDDEN: true,
  INVALID_STATE: true,
  PROVIDER_ERROR: true,
  INTERNAL_ERROR: true
};

function formError(code: string, init: { status?: number; retryable?: boolean } = {}) {
  return new MoreflowFormError({
    message: 'Developer-facing English server text.',
    code,
    responseBody: { error: { code, message: 'Developer-facing English server text.' } },
    ...init
  });
}

describe('localized formErrorMessage', () => {
  it('has German and English copy for every FormErrorCode and never shows the server text', () => {
    for (const code of Object.keys(everyCode)) {
      for (const language of ['de', 'en'] as const) {
        const message = formErrorMessage(formError(code), { language });
        expect(message, `${code} ${language}`).not.toContain('Developer-facing');
        expect(message.length, `${code} ${language}`).toBeGreaterThan(10);
      }
    }
  });

  it('addresses German visitors with Sie by default and du when informal', () => {
    const error = formError('VERIFICATION_PROOF_EXPIRED');

    expect(formErrorMessage(error, { language: 'de' })).toBe(
      'Der Code ist abgelaufen. Bitte fordern Sie einen neuen Code an.'
    );
    expect(formErrorMessage(error, { language: 'de', formality: 'informal' })).toBe(
      'Der Code ist abgelaufen. Bitte fordere einen neuen Code an.'
    );
    expect(formErrorMessage(error, { language: 'en', formality: 'informal' })).toBe(
      'The code has expired. Please request a new code.'
    );
  });

  it('prefers messages.errors overrides, then rate-limit and connection copy for unknown codes', () => {
    expect(
      formErrorMessage(formError('FORM_NOT_FOUND'), {
        messages: { errors: { FORM_NOT_FOUND: 'Dieses Formular gibt es nicht mehr.' } }
      })
    ).toBe('Dieses Formular gibt es nicht mehr.');
    expect(formErrorMessage(formError('SOMETHING_NEW', { status: 429 }), { language: 'en' })).toBe(
      'Too many attempts. Please wait a moment and try again.'
    );
    expect(formErrorMessage(formError('RATE_LIMITED'), { language: 'en' })).toBe(
      'Too many attempts. Please wait a moment and try again.'
    );
    expect(formErrorMessage(formError('REQUEST_FAILED', { retryable: true }), { language: 'en' })).toBe(
      'The connection failed. Please try again.'
    );
    expect(formErrorMessage(formError('SOMETHING_NEW'), { language: 'en', fallback: 'Oops.' })).toBe(
      'Oops.'
    );
    expect(formErrorMessage(new Error('boom'), { language: 'de' })).toBe(
      'Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.'
    );
  });

  it('keeps the raw server message without options', () => {
    expect(formErrorMessage(formError('FORM_NOT_FOUND'))).toBe('Developer-facing English server text.');
    expect(formErrorMessage(new Error(''), 'Fallback text')).toBe('Fallback text');
  });
});

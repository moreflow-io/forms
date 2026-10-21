import { isRecord } from './internal/values';
import type { FormCopyOptions } from './messages';

interface ErrorCopy {
  /** German, addressing the visitor with "Sie". */
  de: string;
  /** German with "du", when it differs from the "Sie" text. */
  deInformal?: string;
  en: string;
}

/**
 * Visitor-facing copy for every known `FormErrorCode`. The server's own
 * `message` is English and written for developers, so localized
 * `formErrorMessage` never shows it.
 */
const errorCopy: Readonly<Record<string, ErrorCopy>> = {
  ABORTED: { de: 'Die Anfrage wurde abgebrochen.', en: 'The request was cancelled.' },
  NETWORK_ERROR: {
    de: 'Die Verbindung ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    deInformal: 'Die Verbindung ist fehlgeschlagen. Bitte versuche es erneut.',
    en: 'The connection failed. Please try again.'
  },
  FETCH_UNAVAILABLE: {
    de: 'Das Formular kann in dieser Umgebung nicht gesendet werden.',
    en: 'This form cannot be sent in this environment.'
  },
  VALIDATION_ERROR: {
    de: 'Bitte füllen Sie alle Pflichtfelder aus.',
    deInformal: 'Bitte fülle alle Pflichtfelder aus.',
    en: 'Please fill in all required fields.'
  },
  INVALID_RESPONSE: {
    de: 'Der Server hat unerwartet geantwortet. Bitte versuchen Sie es erneut.',
    deInformal: 'Der Server hat unerwartet geantwortet. Bitte versuche es erneut.',
    en: 'The server sent an unexpected response. Please try again.'
  },
  REQUEST_FAILED: {
    de: 'Die Anfrage ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
    deInformal: 'Die Anfrage ist fehlgeschlagen. Bitte versuche es erneut.',
    en: 'The request failed. Please try again.'
  },
  INVALID_SUBMISSION_HEADERS: {
    de: 'Das Formular ist auf dieser Seite falsch eingebunden.',
    en: 'The form is not embedded correctly on this page.'
  },
  INVALID_PHONE_NUMBER: {
    de: 'Bitte geben Sie eine gültige Telefonnummer ein.',
    deInformal: 'Bitte gib eine gültige Telefonnummer ein.',
    en: 'Please enter a valid phone number.'
  },
  INVALID_VERIFICATION_CODE: {
    de: 'Der Code ist ungültig. Bitte überprüfen Sie Ihre Eingabe.',
    deInformal: 'Der Code ist ungültig. Bitte überprüfe deine Eingabe.',
    en: 'The code is invalid. Please check your entry.'
  },
  VERIFICATION_PROOF_EXPIRED: {
    de: 'Der Code ist abgelaufen. Bitte fordern Sie einen neuen Code an.',
    deInformal: 'Der Code ist abgelaufen. Bitte fordere einen neuen Code an.',
    en: 'The code has expired. Please request a new code.'
  },
  VERIFICATION_PROOF_REPLAYED: {
    de: 'Dieser Code wurde bereits verwendet. Bitte fordern Sie einen neuen Code an.',
    deInformal: 'Dieser Code wurde bereits verwendet. Bitte fordere einen neuen Code an.',
    en: 'This code has already been used. Please request a new code.'
  },
  INVALID_VERIFICATION_PROOF: {
    de: 'Die Bestätigung ist ungültig. Bitte fordern Sie einen neuen Code an.',
    deInformal: 'Die Bestätigung ist ungültig. Bitte fordere einen neuen Code an.',
    en: 'The verification is not valid. Please request a new code.'
  },
  INVALID_FORM_DEFINITION: {
    de: 'Das Formular hat ein ungültiges Format.',
    en: 'The form has an invalid format.'
  },
  TURNSTILE_UNAVAILABLE: {
    de: 'Der Spamschutz konnte nicht geladen werden. Bitte laden Sie die Seite neu.',
    deInformal: 'Der Spamschutz konnte nicht geladen werden. Bitte lade die Seite neu.',
    en: 'The spam protection could not be loaded. Please reload the page.'
  },
  FORM_NOT_FOUND: { de: 'Dieses Formular wurde nicht gefunden.', en: 'This form was not found.' },
  FORM_RETIRED: {
    de: 'Dieses Formular ist nicht mehr verfügbar.',
    en: 'This form is no longer available.'
  },
  FORM_UNPUBLISHED: {
    de: 'Dieses Formular ist derzeit nicht verfügbar.',
    en: 'This form is currently unavailable.'
  },
  ORIGIN_NOT_ALLOWED: {
    de: 'Dieses Formular kann auf dieser Website nicht verwendet werden.',
    en: 'This form cannot be used on this website.'
  },
  INVALID_SUBMISSION: {
    de: 'Das Formular konnte nicht übermittelt werden. Bitte prüfen Sie Ihre Angaben.',
    deInformal: 'Das Formular konnte nicht übermittelt werden. Bitte prüfe deine Angaben.',
    en: 'The form could not be submitted. Please check your entries.'
  },
  SPAM_REJECTED: {
    de: 'Ihre Anfrage wurde als Spam erkannt.',
    deInformal: 'Deine Anfrage wurde als Spam erkannt.',
    en: 'Your request was flagged as spam.'
  },
  ANTI_SPAM_REQUIRED: {
    de: 'Bitte warten Sie, bis der Spamschutz geladen ist, und senden Sie das Formular erneut.',
    deInformal: 'Bitte warte, bis der Spamschutz geladen ist, und sende das Formular erneut.',
    en: 'Please wait for the spam protection to load and submit again.'
  },
  ANTI_SPAM_INVALID: {
    de: 'Der Spamschutz konnte Ihre Anfrage nicht bestätigen. Bitte versuchen Sie es erneut.',
    deInformal: 'Der Spamschutz konnte deine Anfrage nicht bestätigen. Bitte versuche es erneut.',
    en: 'The spam protection could not verify your request. Please try again.'
  },
  IDEMPOTENCY_CONFLICT: {
    de: 'Diese Anfrage wurde bereits gesendet. Bitte laden Sie die Seite neu.',
    deInformal: 'Diese Anfrage wurde bereits gesendet. Bitte lade die Seite neu.',
    en: 'This request was already sent. Please reload the page.'
  },
  RATE_LIMIT: {
    de: 'Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es dann erneut.',
    deInformal: 'Zu viele Versuche. Bitte warte einen Moment und versuche es dann erneut.',
    en: 'Too many attempts. Please wait a moment and try again.'
  },
  FORBIDDEN: { de: 'Diese Anfrage ist nicht erlaubt.', en: 'This request is not allowed.' },
  INVALID_STATE: {
    de: 'Dieses Formular ist derzeit nicht verfügbar.',
    en: 'This form is currently unavailable.'
  },
  PROVIDER_ERROR: {
    de: 'Ein externer Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es später erneut.',
    deInformal: 'Ein externer Dienst ist gerade nicht erreichbar. Bitte versuche es später erneut.',
    en: 'An external service is unavailable right now. Please try again later.'
  },
  INTERNAL_ERROR: {
    de: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    deInformal: 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.',
    en: 'An unexpected error occurred. Please try again.'
  }
};

/** Server codes that share another code's copy. */
const codeAliases: Readonly<Record<string, string>> = { RATE_LIMITED: 'RATE_LIMIT' };

function copyText(copy: ErrorCopy, options: FormCopyOptions): string {
  if ((options.language ?? 'de') === 'en') return copy.en;
  return options.formality === 'informal' ? (copy.deInformal ?? copy.de) : copy.de;
}

function errorFields(error: unknown): { code?: string; status?: number; retryable: boolean } {
  if (!isRecord(error)) return { retryable: false };
  return {
    ...(typeof error.code === 'string' ? { code: error.code } : {}),
    ...(typeof error.status === 'number' ? { status: error.status } : {}),
    retryable: error.retryable === true
  };
}

export interface LocalizedFormErrorOptions extends FormCopyOptions {
  /** Shown for errors without known copy; defaults to the localized `REQUEST_FAILED` text. */
  fallback?: string | undefined;
}

/**
 * The visitor-facing text for a failure: the `messages.errors` override for
 * its code, else the package copy for the code, else a connection hint for
 * retryable failures, else `fallback`.
 */
export function localizedFormErrorMessage(
  error: unknown,
  options: LocalizedFormErrorOptions = {}
): string {
  const { code, status, retryable } = errorFields(error);
  const text = (key: string): string | undefined => {
    const override = options.messages?.errors?.[key];
    if (override) return override;
    const copy = errorCopy[key];
    return copy ? copyText(copy, options) : undefined;
  };
  const known =
    code && code !== 'REQUEST_FAILED'
      ? (options.messages?.errors?.[code] ?? text(codeAliases[code] ?? code))
      : undefined;
  if (known) return known;
  if (status === 429) return text('RATE_LIMIT') ?? '';
  if (retryable) return text('NETWORK_ERROR') ?? '';
  return options.fallback ?? text('REQUEST_FAILED') ?? '';
}

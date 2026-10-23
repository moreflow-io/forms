import {
  type AcquisitionTracking,
  captureAcquisitionTracking,
  resolveStorage,
  type StorageLike,
  type TrackingCaptureOptions
} from '@moreflow/tracking';
import { MoreflowFormError } from './error';
import {
  type AcquisitionTrackingSetting,
  acquisitionTrackingEnabled
} from './internal/acquisition-tracking';
import {
  abortedErrorInit,
  fetchUnavailableInit,
  networkErrorInit,
  operationErrorInit,
  retryableStatus,
  validationErrorInit
} from './internal/errors';
import { readResponseBody, resolveBaseUrl, resolveFetch } from './internal/http';
import { createRandomId } from './internal/values';
import type { JsonObject, JsonValue } from './json';
import type { FormMessageLanguage } from './messages';

/** @deprecated Use AcquisitionTracking from @moreflow/tracking for new shared integrations. */
export type PublicFormTracking = AcquisitionTracking;

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

export function serializeForFingerprint(value: unknown): string {
  return JSON.stringify(stableValue(value)) ?? 'null';
}

function djb2Hash(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(hash, 33) ^ value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function fingerprintPayload(value: unknown): Promise<string> {
  const serialized = serializeForFingerprint(value);
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle) {
    try {
      const digest = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(serialized));
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
        ''
      );
    } catch {
      // Some browser contexts expose crypto.subtle but reject digest operations.
    }
  }
  return `djb2-${djb2Hash(serialized)}`;
}

/** A v4 UUID from Web Crypto, or a non-cryptographic `mf_` id where Web Crypto is unavailable. */
export function createIdempotencyKey(): string {
  return createRandomId();
}

export interface IdempotencyAttempt {
  key: string;
  payloadHash: string;
  requestBody?: string;
}

export interface IdempotencyStore {
  prepare(
    payload: unknown,
    createRequestBody?: (key: string) => string
  ): Promise<IdempotencyAttempt>;
  read(): IdempotencyAttempt | null;
  clear(): void;
}

function parseAttempt(value: string | null): IdempotencyAttempt | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') return null;
    const key = Reflect.get(parsed, 'key');
    const payloadHash = Reflect.get(parsed, 'payloadHash');
    const requestBody = Reflect.get(parsed, 'requestBody');
    return typeof key === 'string' && key.length > 0 && typeof payloadHash === 'string'
      ? { key, payloadHash, ...(typeof requestBody === 'string' ? { requestBody } : {}) }
      : null;
  } catch {
    return null;
  }
}

export function createIdempotencyStore(options: {
  storage?: StorageLike | undefined;
  storageKey: string;
}): IdempotencyStore {
  const storage = resolveStorage(options.storage);
  let current = parseAttempt(storage.getItem(options.storageKey));

  return {
    async prepare(payload, createRequestBody) {
      const payloadHash = await fingerprintPayload(payload);
      if (
        current?.payloadHash === payloadHash &&
        (!createRequestBody || current.requestBody !== undefined)
      ) {
        return current;
      }

      // Keep the key when only the stored body is missing (records written by
      // older versions), so a pending server-side attempt can still be replayed.
      const key = current?.payloadHash === payloadHash ? current.key : createIdempotencyKey();
      const next: IdempotencyAttempt = { key, payloadHash };
      if (createRequestBody) next.requestBody = createRequestBody(key);
      current = next;
      storage.setItem(options.storageKey, JSON.stringify(next));
      return next;
    },
    read() {
      current = parseAttempt(storage.getItem(options.storageKey));
      return current;
    },
    clear() {
      current = null;
      storage.removeItem(options.storageKey);
    }
  };
}

export interface PublicFormSubmissionInput {
  data: JsonObject;
  /**
   * Optional and ignored for mapping: Moreflow maps `data` to client fields
   * from the stored published form. Accepted so older embeds keep working.
   */
  fieldMatching?: JsonValue[] | undefined;
  utmParams?: JsonObject | undefined;
  tracking?: PublicFormTracking | undefined;
  consent?: JsonObject | undefined;
  /**
   * The language the visitor saw the form in. Moreflow rebuilds the consent
   * text of a ticked `marketing_consent` box in this language to evidence the
   * consent, so pass the `language` you rendered with. Defaults to `'de'`, the
   * default of `resolveFormMessage` and `marketingConsentText`.
   */
  locale?: FormMessageLanguage | undefined;
  spam?: JsonObject | undefined;
  formEntryId?: string | undefined;
}

export interface SubmitWithRetryOptions {
  formId: string;
  input: PublicFormSubmissionInput;
  /**
   * Captures acquisition tracking when no `input.tracking` is passed. Off by
   * default because the capture reads Meta cookies and writes browser storage,
   * which needs the visitor's consent in the EU.
   */
  acquisitionTracking?: AcquisitionTrackingSetting | undefined;
  /**
   * Capture options or a callback replacing the built-in capture. Unset
   * options use `configureAcquisitionTracking()`, so a page that configures it once
   * submits the same values it captures on every route change.
   */
  trackingCapture?: TrackingCaptureOptions | (() => PublicFormTracking | undefined) | undefined;
  /**
   * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
   * to call your page's own origin behind a same-origin proxy.
   */
  baseUrl?: string | undefined;
  /** Sends `Authorization: Bearer <token>` with every submission attempt. */
  token?: string | undefined;
  /** Additional request headers sent with every submission attempt. */
  headers?: Record<string, string> | undefined;
  fetchImpl?: typeof fetch | undefined;
  storage?: StorageLike | undefined;
  maxAttempts?: number | undefined;
  retryDelayMs?: number | undefined;
  maxRetryDelayMs?: number | undefined;
  sleep?: ((milliseconds: number) => Promise<void>) | undefined;
  signal?: AbortSignal | undefined;
}

export interface SubmitWithRetryResult<T = unknown> {
  data: T;
  response: Response;
  idempotencyKey: string;
  replayed: boolean;
}

function retryDelay(
  response: Response,
  attempt: number,
  baseDelay: number,
  maxDelay: number
): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = Number(retryAfterHeader);
  const delay =
    retryAfterHeader !== null && Number.isFinite(retryAfter) && retryAfter >= 0
      ? retryAfter * 1000
      : baseDelay * 2 ** attempt;
  return Math.min(delay, maxDelay);
}

function submissionHeaders(options: SubmitWithRetryOptions): Headers {
  try {
    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
    return headers;
  } catch (cause) {
    throw new MoreflowFormError({
      message: 'The form submission headers or token contain an invalid value.',
      code: 'INVALID_SUBMISSION_HEADERS',
      retryable: false,
      details: { field: options.token ? 'token' : 'headers' },
      cause
    });
  }
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function submitWithRetry<T = unknown>(
  options: SubmitWithRetryOptions
): Promise<SubmitWithRetryResult<T>> {
  if (!options.formId.trim()) {
    throw new MoreflowFormError(validationErrorInit('formId', 'formId is required.'));
  }

  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  const maxRetryDelayMs = Math.max(retryDelayMs, options.maxRetryDelayMs ?? 30_000);
  const sleep = options.sleep ?? defaultSleep;
  const fetchImpl = resolveFetch(options.fetchImpl);
  if (!fetchImpl) throw new MoreflowFormError(fetchUnavailableInit('@moreflow/forms'));
  // Header and bearer-token validation is deterministic. Build it before any
  // idempotency state or retry work so invalid caller input fails immediately.
  const headers = submissionHeaders(options);

  const { tracking: inputTracking, ...inputFields } = options.input;
  const inputWithoutTracking = { ...inputFields, locale: inputFields.locale ?? 'de' };
  const explicitTracking = inputTracking;
  const capturedTracking =
    explicitTracking ??
    (acquisitionTrackingEnabled(options.acquisitionTracking)
      ? typeof options.trackingCapture === 'function'
        ? options.trackingCapture()
        : captureAcquisitionTracking(options.trackingCapture)
      : undefined);
  const tracking = capturedTracking ? Object.freeze({ ...capturedTracking }) : undefined;
  // Everything except tracking participates in the fingerprint: a changed
  // consent, locale, spam, or formEntryId is a materially different submission and
  // must not replay under the previous idempotency key.
  const fingerprint = {
    formId: options.formId,
    ...inputWithoutTracking
  };
  const store = createIdempotencyStore({
    storage: options.storage,
    storageKey: `moreflow:idempotency:${options.formId}`
  });
  // The serialized body is persisted with the attempt so a later call with the
  // same business payload replays the exact same bytes (including the tracking
  // snapshot captured when the attempt was first created).
  const attempt = await store.prepare(fingerprint, (key) =>
    JSON.stringify({ ...inputWithoutTracking, tracking, idempotencyKey: key })
  );
  const body =
    attempt.requestBody ??
    JSON.stringify({ ...inputWithoutTracking, tracking, idempotencyKey: attempt.key });
  const url = `${resolveBaseUrl({ baseUrl: options.baseUrl })}/v1/forms/${encodeURIComponent(options.formId)}/submissions`;
  headers.set('Idempotency-Key', attempt.key);

  for (let retry = 0; retry < maxAttempts; retry += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers,
        body,
        ...(options.signal ? { signal: options.signal } : {})
      });
      const shouldRetry = retryableStatus(response.status) && retry < maxAttempts - 1;
      if (shouldRetry) {
        await sleep(retryDelay(response, retry, retryDelayMs, maxRetryDelayMs));
        continue;
      }

      const responseBody = await readResponseBody(response);
      if (response.ok) {
        store.clear();
        return {
          data: responseBody as T,
          response,
          idempotencyKey: attempt.key,
          replayed: response.headers.get('Idempotency-Replayed') === 'true'
        };
      }

      throw new MoreflowFormError(
        operationErrorInit({
          responseBody,
          status: response.status,
          fallbackMessage: 'Moreflow form submission failed'
        })
      );
    } catch (error) {
      if (error instanceof MoreflowFormError) throw error;
      if (options.signal?.aborted) {
        throw new MoreflowFormError(
          abortedErrorInit('Moreflow form submission was aborted.', options.signal)
        );
      }
      if (retry >= maxAttempts - 1) {
        throw new MoreflowFormError(
          networkErrorInit('Moreflow form submission failed before a response was received.', error)
        );
      }
      await sleep(Math.min(retryDelayMs * 2 ** retry, maxRetryDelayMs));
    }
  }

  throw new MoreflowFormError({
    message: 'Moreflow form submission exhausted its retry budget.',
    code: 'NETWORK_ERROR',
    retryable: true
  });
}

import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';
import {
  captureAcquisitionTracking,
  createMemoryStorage,
  guardStorage,
  resolveStorage,
  trackingKeys,
  type AcquisitionTracking,
  type StorageLike
} from '@moreflow/tracking';

export {
  captureAcquisitionTracking,
  createMemoryStorage,
  guardStorage,
  resolveStorage,
  trackingKeys
};
export type {
  AcquisitionTracking,
  StorageLike,
  TrackingCaptureOptions,
  TrackingKey
} from '@moreflow/tracking';
/** @deprecated Use AcquisitionTracking from @moreflow/tracking for new shared integrations. */
export type PublicFormTracking = AcquisitionTracking;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
export type JsonObject = { [key: string]: JsonValue | undefined };

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

function browserCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('The Moreflow forms helper requires Web Crypto (crypto.getRandomValues).');
  }
  return cryptoApi;
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

export function createIdempotencyKey(): string {
  const cryptoApi = browserCrypto();
  if (typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID();

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] ?? 0) & 0x0f;
  bytes[6] = (bytes[6] ?? 0) | 0x40;
  bytes[8] = (bytes[8] ?? 0) & 0x3f;
  bytes[8] = (bytes[8] ?? 0) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`;
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

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'DE';

export type NormalizePhoneNumberOptions = {
  defaultCountry?: CountryCode | undefined;
};

export type NormalizedPhoneNumber =
  | { status: 'empty' }
  | { status: 'valid'; e164: string }
  | { status: 'invalid'; input: string };

export function normalizePhoneNumber(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): NormalizedPhoneNumber {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed || trimmed === '+') return { status: 'empty' };

  // extract: false rejects phone numbers embedded in surrounding prose; only
  // an input that is entirely one phone number (plus formatting) is valid.
  const parsed = parsePhoneNumberFromString(trimmed, {
    defaultCountry: options.defaultCountry ?? DEFAULT_PHONE_COUNTRY,
    extract: false
  });
  if (!parsed?.isValid()) return { status: 'invalid', input: trimmed };
  return { status: 'valid', e164: parsed.number };
}

export function normalizePhoneToE164(
  raw: string | null | undefined,
  options: NormalizePhoneNumberOptions = {}
): string | null {
  const result = normalizePhoneNumber(raw, options);
  return result.status === 'valid' ? result.e164 : null;
}

export interface PublicFormSubmissionInput {
  data: JsonObject;
  fieldMatching?: JsonValue[] | undefined;
  utmParams?: JsonObject | undefined;
  tracking?: PublicFormTracking | undefined;
  consent?: JsonObject | undefined;
  spam?: JsonObject | undefined;
  formEntryId?: string | undefined;
}

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

export interface SubmitWithRetryOptions {
  formId: string;
  input: PublicFormSubmissionInput;
  tracking?: PublicFormTracking | undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.clone().text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorCode(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error) || typeof body.error.code !== 'string')
    return undefined;
  return body.error.code;
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

function retryableStatus(status: number): boolean {
  return status === 425 || status === 429 || status >= 500;
}

function submissionHeaders(options: SubmitWithRetryOptions, idempotencyKey: string): Headers {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('Idempotency-Key', idempotencyKey);
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);
  return headers;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function submitWithRetry<T = unknown>(
  options: SubmitWithRetryOptions
): Promise<SubmitWithRetryResult<T>> {
  if (!options.formId.trim()) throw new Error('formId is required.');

  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  const maxRetryDelayMs = Math.max(retryDelayMs, options.maxRetryDelayMs ?? 30_000);
  const sleep = options.sleep ?? defaultSleep;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error('A fetch implementation is required to submit a Moreflow form.');

  const { tracking: inputTracking, ...inputWithoutTracking } = options.input;
  const tracking = Object.freeze({
    ...(options.tracking ??
      inputTracking ??
      captureAcquisitionTracking({ storage: options.storage }))
  });
  // Everything except tracking participates in the fingerprint: a changed
  // consent, spam, or formEntryId is a materially different submission and
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
  const url = `${(options.baseUrl ?? '').replace(/\/$/u, '')}/api/v1/forms/${encodeURIComponent(options.formId)}/submissions`;

  for (let retry = 0; retry < maxAttempts; retry += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: submissionHeaders(options, attempt.key),
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

      throw new MoreflowFormError({
        message: `Moreflow form submission failed with HTTP ${response.status}.`,
        status: response.status,
        code: errorCode(responseBody),
        retryable: retryableStatus(response.status),
        responseBody
      });
    } catch (error) {
      if (error instanceof MoreflowFormError) throw error;
      if (options.signal?.aborted) throw error;
      if (retry >= maxAttempts - 1) {
        throw new MoreflowFormError({
          message: 'Moreflow form submission failed before a response was received.',
          retryable: true,
          cause: error
        });
      }
      await sleep(Math.min(retryDelayMs * 2 ** retry, maxRetryDelayMs));
    }
  }

  throw new MoreflowFormError({
    message: 'Moreflow form submission exhausted its retry budget.',
    retryable: true
  });
}

import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue | undefined };
export type JsonObject = { [key: string]: JsonValue | undefined };

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const defaultStorageKey = 'moreflow:acquisition:v1';

function createDefaultStorage(): StorageLike {
  try {
    if (typeof globalThis.sessionStorage !== 'undefined') {
      const browserStorage = globalThis.sessionStorage;
      const fallback = createMemoryStorage();
      return {
        getItem: (key) => {
          try {
            return browserStorage.getItem(key);
          } catch {
            return fallback.getItem(key);
          }
        },
        setItem: (key, value) => {
          try {
            browserStorage.setItem(key, value);
          } catch {
            fallback.setItem(key, value);
          }
        },
        removeItem: (key) => {
          try {
            browserStorage.removeItem(key);
          } catch {
            fallback.removeItem(key);
          }
        }
      };
    }
  } catch {
    // Access to browser storage can throw when third-party storage is blocked.
  }
  return createMemoryStorage();
}

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

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
      const digest = await cryptoApi.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(serialized)
      );
      return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
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
}

export interface IdempotencyStore {
  prepare(payload: unknown): Promise<IdempotencyAttempt>;
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
    return typeof key === 'string' && key.length > 0 && typeof payloadHash === 'string'
      ? { key, payloadHash }
      : null;
  } catch {
    return null;
  }
}

export function createIdempotencyStore(options: {
  storage?: StorageLike | undefined;
  storageKey: string;
}): IdempotencyStore {
  const storage = options.storage ?? createDefaultStorage();
  let current = parseAttempt(storage.getItem(options.storageKey));

  return {
    async prepare(payload) {
      const payloadHash = await fingerprintPayload(payload);
      if (current?.payloadHash === payloadHash) return current;

      current = { key: createIdempotencyKey(), payloadHash };
      storage.setItem(options.storageKey, JSON.stringify(current));
      return current;
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

export const trackingKeys = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_campaignid',
  'gad_campaignid',
  'gclid',
  'gbraid',
  'wbraid',
  'gad_source',
  'fbclid',
  'fbp',
  'fbc',
  'ttclid',
  'ttp',
  'page_url',
  'referrer',
  'user_agent'
] as const;

export type TrackingKey = (typeof trackingKeys)[number];
export type PublicFormTracking = Partial<Record<TrackingKey, string>>;

export interface TrackingCaptureOptions {
  location?: { href?: string; search?: string } | undefined;
  cookie?: string | undefined;
  referrer?: string | undefined;
  userAgent?: string | undefined;
  now?: number | undefined;
  storage?: StorageLike | undefined;
  persistenceKey?: string | undefined;
}

function readCookie(cookie: string, name: string): string | undefined {
  for (const pair of cookie.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    const value = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

function readPersistedTracking(storage: StorageLike, key: string): PublicFormTracking {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? 'null');
    if (!parsed || typeof parsed !== 'object') return {};
    const result: PublicFormTracking = {};
    for (const trackingKey of trackingKeys) {
      const value = Reflect.get(parsed, trackingKey);
      if (typeof value === 'string' && value.length > 0) result[trackingKey] = value;
    }
    return result;
  } catch {
    return {};
  }
}

export function captureAcquisitionTracking(
  options: TrackingCaptureOptions = {}
): PublicFormTracking {
  const pageLocation =
    options.location ??
    (typeof globalThis.location === 'undefined' ? undefined : globalThis.location);
  const cookie =
    options.cookie ??
    (typeof globalThis.document === 'undefined' ? '' : globalThis.document.cookie);
  const storage = options.storage ?? createDefaultStorage();
  const persistenceKey = options.persistenceKey ?? defaultStorageKey;
  const current: PublicFormTracking = {};
  const search = pageLocation?.search ?? '';

  try {
    const params = new URL(pageLocation?.href ?? search, 'https://moreflow.invalid').searchParams;
    for (const trackingKey of trackingKeys) {
      if (trackingKey === 'page_url' || trackingKey === 'referrer' || trackingKey === 'user_agent') continue;
      const value = params.get(trackingKey);
      if (value) current[trackingKey] = value;
    }
  } catch {
    // A malformed location should not prevent a form from being submitted.
  }

  const fbp = readCookie(cookie, '_fbp');
  const fbc = readCookie(cookie, '_fbc');
  if (fbp) current.fbp = fbp;
  if (fbc) current.fbc = fbc;
  if (!current.fbc && current.fbclid) {
    current.fbc = `fb.1.${options.now ?? Date.now()}.${current.fbclid}`;
  }
  if (pageLocation?.href) current.page_url = pageLocation.href;
  if (options.referrer) current.referrer = options.referrer;
  if (options.userAgent) current.user_agent = options.userAgent;

  const tracking = { ...readPersistedTracking(storage, persistenceKey), ...current };
  storage.setItem(persistenceKey, JSON.stringify(tracking));
  return Object.freeze(tracking);
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

  const parsed = parsePhoneNumberFromString(
    trimmed,
    options.defaultCountry ?? DEFAULT_PHONE_COUNTRY
  );
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
  fetchImpl?: typeof fetch | undefined;
  storage?: StorageLike | undefined;
  maxAttempts?: number | undefined;
  retryDelayMs?: number | undefined;
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
  if (!isRecord(body) || !isRecord(body.error) || typeof body.error.code !== 'string') return undefined;
  return body.error.code;
}

function retryDelay(response: Response, attempt: number, baseDelay: number): number {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = Number(retryAfterHeader);
  return retryAfterHeader !== null && Number.isFinite(retryAfter) && retryAfter >= 0
    ? retryAfter * 1000
    : baseDelay * 2 ** attempt;
}

function retryableStatus(status: number): boolean {
  return status === 425 || status === 429 || status >= 500;
}

const defaultSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function submitWithRetry<T = unknown>(
  options: SubmitWithRetryOptions
): Promise<SubmitWithRetryResult<T>> {
  if (!options.formId.trim()) throw new Error('formId is required.');

  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? 250);
  const sleep = options.sleep ?? defaultSleep;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) throw new Error('A fetch implementation is required to submit a Moreflow form.');

  const { tracking: inputTracking, ...inputWithoutTracking } = options.input;
  const tracking = Object.freeze({
    ...(options.tracking ?? inputTracking ?? captureAcquisitionTracking({ storage: options.storage }))
  });
  const fingerprint = {
    formId: options.formId,
    data: options.input.data,
    fieldMatching: options.input.fieldMatching
  };
  const store = createIdempotencyStore({
    storage: options.storage,
    storageKey: `moreflow:idempotency:${options.formId}`
  });
  const attempt = await store.prepare(fingerprint);
  const body = JSON.stringify({
    ...inputWithoutTracking,
    tracking,
    idempotencyKey: attempt.key
  });
  const url = `${(options.baseUrl ?? '').replace(/\/$/u, '')}/api/v1/forms/${encodeURIComponent(options.formId)}/submissions`;

  for (let retry = 0; retry < maxAttempts; retry += 1) {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': attempt.key
        },
        body,
        ...(options.signal ? { signal: options.signal } : {})
      });
      const shouldRetry = retryableStatus(response.status) && retry < maxAttempts - 1;
      if (shouldRetry) {
        await sleep(retryDelay(response, retry, retryDelayMs));
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
      await sleep(retryDelayMs * 2 ** retry);
    }
  }

  throw new MoreflowFormError({
    message: 'Moreflow form submission exhausted its retry budget.',
    retryable: true
  });
}

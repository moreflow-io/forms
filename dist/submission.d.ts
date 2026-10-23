import { type AcquisitionTracking, type StorageLike, type TrackingCaptureOptions } from '@moreflow/tracking';
import { type AcquisitionTrackingSetting } from './internal/acquisition-tracking';
import type { JsonObject, JsonValue } from './json';
import type { FormMessageLanguage } from './messages';
/** @deprecated Use AcquisitionTracking from @moreflow/tracking for new shared integrations. */
export type PublicFormTracking = AcquisitionTracking;
export declare function serializeForFingerprint(value: unknown): string;
export declare function fingerprintPayload(value: unknown): Promise<string>;
/** A v4 UUID from Web Crypto, or a non-cryptographic `mf_` id where Web Crypto is unavailable. */
export declare function createIdempotencyKey(): string;
export interface IdempotencyAttempt {
    key: string;
    payloadHash: string;
    requestBody?: string;
}
export interface IdempotencyStore {
    prepare(payload: unknown, createRequestBody?: (key: string) => string): Promise<IdempotencyAttempt>;
    read(): IdempotencyAttempt | null;
    clear(): void;
}
export declare function createIdempotencyStore(options: {
    storage?: StorageLike | undefined;
    storageKey: string;
}): IdempotencyStore;
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
export declare function submitWithRetry<T = unknown>(options: SubmitWithRetryOptions): Promise<SubmitWithRetryResult<T>>;

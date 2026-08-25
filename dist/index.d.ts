import { type CountryCode } from 'libphonenumber-js';
import { captureAcquisitionTracking, createMemoryStorage, guardStorage, resolveStorage, trackingKeys, type AcquisitionTracking, type StorageLike } from '@moreflow/tracking';
export { captureAcquisitionTracking, createMemoryStorage, guardStorage, resolveStorage, trackingKeys };
export type { AcquisitionTracking, StorageLike, TrackingCaptureOptions, TrackingKey } from '@moreflow/tracking';
/** @deprecated Use AcquisitionTracking from @moreflow/tracking for new shared integrations. */
export type PublicFormTracking = AcquisitionTracking;
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | {
    [key: string]: JsonValue | undefined;
};
export type JsonObject = {
    [key: string]: JsonValue | undefined;
};
export declare function serializeForFingerprint(value: unknown): string;
export declare function fingerprintPayload(value: unknown): Promise<string>;
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
export declare const DEFAULT_PHONE_COUNTRY: CountryCode;
export type NormalizePhoneNumberOptions = {
    defaultCountry?: CountryCode | undefined;
};
export type NormalizedPhoneNumber = {
    status: 'empty';
} | {
    status: 'valid';
    e164: string;
} | {
    status: 'invalid';
    input: string;
};
export declare function normalizePhoneNumber(raw: string | null | undefined, options?: NormalizePhoneNumberOptions): NormalizedPhoneNumber;
export declare function normalizePhoneToE164(raw: string | null | undefined, options?: NormalizePhoneNumberOptions): string | null;
export interface PublicFormSubmissionInput {
    data: JsonObject;
    fieldMatching?: JsonValue[] | undefined;
    utmParams?: JsonObject | undefined;
    tracking?: PublicFormTracking | undefined;
    consent?: JsonObject | undefined;
    spam?: JsonObject | undefined;
    formEntryId?: string | undefined;
}
export declare class MoreflowFormError extends Error {
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
    });
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
export declare function submitWithRetry<T = unknown>(options: SubmitWithRetryOptions): Promise<SubmitWithRetryResult<T>>;

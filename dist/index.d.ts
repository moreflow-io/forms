import { captureAcquisitionTracking, createMemoryStorage, guardStorage, resolveStorage, trackingKeys, type AcquisitionTracking, type StorageLike } from '@moreflow/tracking';
import type { CountryCode } from 'libphonenumber-js';
import { type JsonObject, type JsonValue } from './json';
export { captureAcquisitionTracking, createMemoryStorage, guardStorage, resolveStorage, trackingKeys };
export type { AcquisitionTracking, StorageLike, TrackingCaptureOptions, TrackingKey } from '@moreflow/tracking';
/** @deprecated Use AcquisitionTracking from @moreflow/tracking for new shared integrations. */
export type PublicFormTracking = AcquisitionTracking;
export type { JsonObject, JsonPrimitive, JsonValue } from './json';
export { formErrorMessage, MoreflowFormError, serverErrorCode, serverErrorMessage } from './error';
export { composePhoneNumber, countryCallingCode, DEFAULT_PHONE_COUNTRY, describePhoneInput, normalizePhoneNumber, normalizePhoneToE164 } from './phone';
export type { NormalizedPhoneNumber, NormalizePhoneNumberOptions, PhoneInputParts } from './phone';
export { CONSENT_COMPONENT_TYPES, formInputComponents, getPublicForm, isComponentVisibleToVisitors, normalizePublicFormDefinition, partitionFormPages, PHONE_COMPONENT_TYPES, phoneVerificationComponents, phoneVerificationRequired, PRESENTATIONAL_COMPONENT_TYPES } from './definition';
export type { GetPublicFormOptions, PartitionedFormPages, PublicFormAccountId, PublicFormComponent, PublicFormDefinition, PublicFormFieldMatch, PublicFormOption, PublicFormPage, PublicFormRegularPage, PublicFormSpamProtection, PublicFormThankYouItem, PublicFormThankYouPage, PublicFormTurnstileProtection } from './definition';
export { mountTurnstile } from './turnstile';
export type { MountedTurnstile, TurnstileMountOptions } from './turnstile';
export { prepareSubmissionData, validateComponentValue, validateFormPage, validateFormValues } from './validation';
export type { FormValidationCode, FormValidationIssue, FormValidationOptions } from './validation';
export { FORM_MESSAGE_LANGUAGES, formMessageCatalogs, formMessageId, isFormMessageKey, resolveFormMessage } from './messages';
export type { FormMessageLanguage, ResolveFormMessageOptions } from './messages';
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
export interface PublicFormSubmissionInput {
    data: JsonObject;
    fieldMatching?: JsonValue[] | undefined;
    utmParams?: JsonObject | undefined;
    tracking?: PublicFormTracking | undefined;
    consent?: JsonObject | undefined;
    spam?: JsonObject | undefined;
    formEntryId?: string | undefined;
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
export interface PhoneVerificationRequestOptions {
    formId: string;
    /** Raw phone input; normalized to E.164 with `defaultCountry` before sending. */
    phoneNumber: string;
    defaultCountry?: CountryCode | undefined;
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
/**
 * Starts phone verification for a form whose phone field requires it
 * (`PUT /v1/forms/{formId}/phone-verification`). The server texts a code to
 * the number and returns a challenge id for {@link checkPhoneVerification}.
 *
 * Each call sends a real SMS, so the helper never retries by itself; inspect
 * `MoreflowFormError.retryable` before resending.
 */
export declare function sendPhoneVerification(options: PhoneVerificationRequestOptions): Promise<PhoneVerificationChallenge>;
/**
 * Checks the code the visitor received (`POST /v1/forms/{formId}/phone-verification`).
 * Resolves with the verified E.164 number, or throws `MoreflowFormError` — commonly
 * `INVALID_VERIFICATION_CODE` (let the visitor retype), `VERIFICATION_PROOF_EXPIRED`
 * or `VERIFICATION_PROOF_REPLAYED` (start a new challenge with
 * {@link sendPhoneVerification}).
 */
export declare function checkPhoneVerification(options: CheckPhoneVerificationOptions): Promise<PhoneVerificationResult>;

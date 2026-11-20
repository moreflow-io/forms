import type { CountryCode } from 'libphonenumber-js';
import { type OperationChallengeOptions } from './internal/operation-challenge';
/** Proof comes from the API-hosted frame; form submission widgets remain independent. */
export type PhoneVerificationBotChallengeOptions = Omit<OperationChallengeOptions, 'baseUrl'>;
export interface PhoneVerificationRequestOptions extends PhoneVerificationBotChallengeOptions {
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
/**
 * Starts phone verification for a form whose phone field requires it
 * (`PUT /v1/forms/{formId}/phone-verification`). The server texts a code to
 * the number and returns a challenge id for {@link checkPhoneVerification}.
 *
 * The helper retries only a definitive bot-challenge refusal, once, with fresh
 * proof. It never retries ambiguous SMS/provider/network errors automatically.
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

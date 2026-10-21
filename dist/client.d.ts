import { type GetPublicFormOptions, type PublicFormDefinition } from './definition';
import { type CheckPhoneVerificationOptions, type PhoneVerificationRequestOptions } from './phone-verification';
import type { FormSessionOptions } from './session-types';
import { type SubmitWithRetryOptions } from './submission';
/** Reusable defaults; each call can override them with the same per-call options. */
export type CreateFormsClientOptions = FormSessionOptions;
/** Configure a forms integration once while keeping every operation independently callable. */
export declare function createFormsClient(defaults?: CreateFormsClientOptions): {
    getPublicForm(options: GetPublicFormOptions): Promise<PublicFormDefinition>;
    createFormSession(definition: PublicFormDefinition, options?: FormSessionOptions): import("./session-types").FormSession;
    submitWithRetry<T = unknown>(options: SubmitWithRetryOptions): Promise<import("./submission").SubmitWithRetryResult<T>>;
    sendPhoneVerification(options: PhoneVerificationRequestOptions): Promise<import("./phone-verification").PhoneVerificationChallenge>;
    checkPhoneVerification(options: CheckPhoneVerificationOptions): Promise<import("./phone-verification").PhoneVerificationResult>;
};
export type FormsClient = ReturnType<typeof createFormsClient>;

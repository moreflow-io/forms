import { type PublicFormDefinition } from './definition';
import { type FormCopyOptions } from './messages';
import type { FormSession, FormSessionError, FormSessionOptions } from './session-types';
export type { FormSession, FormSessionError, FormSessionIssue, FormSessionOptions, FormSessionPhoneVerification, FormSessionPhoneVerificationActions, FormSessionResult, FormSessionSnapshot, FormSessionStatus, FormSessionTurnstile, FormSessionTurnstileActions } from './session-types';
/** A caught failure as session state, with its localized message. */
export declare function toFormSessionError(error: unknown, copy: FormCopyOptions): FormSessionError;
/**
 * A framework-agnostic store that runs a public form for a custom embed: wizard
 * steps, values, localized validation, phone verification, honeypot,
 * Turnstile, submission and the thank-you result. Render from `getSnapshot()`
 * and re-render on `subscribe`; the actions keep the hosted form's rules.
 */
export declare function createFormSession(definition: PublicFormDefinition, options?: FormSessionOptions): FormSession;

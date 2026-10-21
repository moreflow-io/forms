import type { AcquisitionTracking, StorageLike, TrackingCaptureOptions } from '@moreflow/tracking';
import type { CountryCode } from 'libphonenumber-js';
import type { PublicFormDefinition, PublicFormRegularPage, PublicFormThankYouPage, PublicFormTurnstileProtection } from './definition';
import type { AcquisitionTrackingSetting } from './internal/acquisition-tracking';
import type { JsonObject, JsonValue } from './json';
import type { FormFormality, FormMessageLanguage, FormMessageOverrides } from './messages';
import type { FormValidationCode } from './validation';
export interface FormSessionOptions {
    /**
     * The Moreflow API origin. Defaults to `https://api.moreflow.io`; pass `''`
     * to call your page's own origin behind a same-origin proxy.
     */
    baseUrl?: string | undefined;
    /** Sends `Authorization: Bearer <token>` with every request. */
    token?: string | undefined;
    headers?: Record<string, string> | undefined;
    fetchImpl?: typeof fetch | undefined;
    /** Storage for the submission idempotency record; defaults to sessionStorage. */
    storage?: StorageLike | undefined;
    /** Render and submit language. Defaults to `definition.language`, then `'de'`. */
    language?: FormMessageLanguage | undefined;
    /** German copy with "Sie" (`'formal'`, the default) or "du" (`'informal'`). */
    formality?: FormFormality | undefined;
    /** Your copy for message keys, validation codes and error codes. */
    messages?: FormMessageOverrides | undefined;
    /**
     * The company name your consent copy shows. Defaults to
     * `definition.companyName`, the name Moreflow evidences the consent with;
     * override it only if your page really shows another name.
     */
    companyName?: string | undefined;
    /** Country for phone numbers typed without a country code. Defaults to `'DE'`. */
    defaultCountry?: CountryCode | undefined;
    initialValues?: Readonly<Record<string, JsonValue | undefined>> | undefined;
    /**
     * Captures acquisition tracking at submit time (see `submitWithRetry`). Off
     * by default; pass `true` or a function that returns `true` once the visitor
     * agreed in your consent banner.
     */
    acquisitionTracking?: AcquisitionTrackingSetting | undefined;
    /** Capture options or a replacement callback; used only when acquisition tracking is on. */
    trackingCapture?: TrackingCaptureOptions | (() => AcquisitionTracking | undefined) | undefined;
    utmParams?: JsonObject | undefined;
    consent?: JsonObject | undefined;
    /** Submission retry attempts; see `submitWithRetry`. */
    maxAttempts?: number | undefined;
}
/** `editing` while the visitor fills in steps, `verifying` while a submission waits for the SMS code. */
export type FormSessionStatus = 'editing' | 'verifying' | 'submitting' | 'submitted';
export interface FormSessionIssue {
    componentId: string;
    componentType: string;
    code: FormValidationCode;
    /** Localized with the session's language, formality and `messages.validation`. */
    message: string;
}
export interface FormSessionError {
    /** The `FormErrorCode`, or `REQUEST_FAILED` for errors without one. */
    code: string;
    /** Localized with the session's language, formality and `messages.errors`. */
    message: string;
    retryable: boolean;
    /** The caught error, for logging. */
    cause: unknown;
}
export interface FormSessionPhoneVerification {
    /** The phone component that needs verification. */
    componentId: string;
    status: 'idle' | 'sending' | 'code_sent' | 'checking' | 'verified';
    /** The E.164 number the code went to, or the verified number. */
    phoneNumber: string | undefined;
    /** The code typed so far (see `phoneVerification.setCode`). */
    code: string;
    expiresAt: string | undefined;
    error: FormSessionError | null;
}
export interface FormSessionTurnstile {
    /** True when the form expects a Turnstile token (a site key and mode `flag` or `require`). */
    enabled: boolean;
    /** With `require`, `submit` waits for a token; with `flag` it submits without one. */
    mode: PublicFormTurnstileProtection['mode'];
    siteKey: string;
    token: string | null;
    status: 'disabled' | 'loading' | 'ready' | 'error';
}
export interface FormSessionResult {
    /** The submission resource the server returned. */
    submission: unknown;
    idempotencyKey: string;
    replayed: boolean;
    /** The thank-you page to render when there is no `redirectUrl`. */
    thankYou: PublicFormThankYouPage | undefined;
    /** An absolute http(s) URL from `settings.thankYouPageUrl`; navigate there yourself. */
    redirectUrl: string | undefined;
}
export interface FormSessionSnapshot {
    definition: PublicFormDefinition;
    language: FormMessageLanguage;
    /** The company name consent copy shows; the `marketing_consent` box is hidden without one. */
    companyName: string | undefined;
    /** Visitor-facing wizard steps (hidden components already removed). */
    steps: readonly PublicFormRegularPage[];
    stepIndex: number;
    step: PublicFormRegularPage | undefined;
    isFirstStep: boolean;
    isLastStep: boolean;
    /** 0 on the first step, 1 once submitted. */
    progress: number;
    values: Readonly<Record<string, JsonValue | undefined>>;
    /** Issues by component id; `next` fills the current step's, `submit` every step's. */
    issues: Readonly<Record<string, FormSessionIssue>>;
    /** The first invalid component after a failed `next`/`submit`; focus it. */
    focusComponentId: string | undefined;
    status: FormSessionStatus;
    /** A form-level failure to show near the buttons. */
    error: FormSessionError | null;
    /** Null unless the form requires SMS verification of a phone field. */
    phoneVerification: FormSessionPhoneVerification | null;
    /** Render an off-screen, `tabIndex={-1}` text input with this name and report its value with `setHoneypot`. */
    honeypot: {
        name: string;
        value: string;
    };
    turnstile: FormSessionTurnstile;
    result: FormSessionResult | null;
    /** Resolved button texts from the form settings. */
    labels: {
        submit: string;
        continue: string;
    };
}
export interface FormSessionPhoneVerificationActions {
    /** Texts a code to the entered number. `submit` calls it for you when needed. */
    sendCode(): Promise<boolean>;
    setCode(code: string): void;
    /** Checks the code (the stored one unless given) and continues a pending submission. */
    verify(code?: string): Promise<boolean>;
    /** Texts a new code to the same number. */
    resend(): Promise<boolean>;
    /** Drops the challenge and returns to the step with the phone field. */
    changeNumber(): void;
}
export interface FormSessionTurnstileActions {
    /** Renders the Moreflow Turnstile widget into `container`; returns a cleanup function. */
    mount(container: HTMLElement): Promise<() => void>;
    /** For a widget you render yourself: report its token (or `null` when it expired). */
    setToken(token: string | null): void;
    /** For a widget you render yourself: report that it failed to load. */
    fail(): void;
}
export interface FormSession {
    getSnapshot(): FormSessionSnapshot;
    subscribe(listener: () => void): () => void;
    setValue(componentId: string, value: JsonValue | undefined): void;
    /** Validates a field the visitor left, once it holds a value. */
    blur(componentId: string): void;
    /** Validates the current step, then moves on, or submits on the last step. */
    next(): Promise<boolean>;
    back(): boolean;
    /** Validates every step, runs phone verification when required, then submits. */
    submit(): Promise<boolean>;
    reset(): void;
    setHoneypot(value: string): void;
    phoneVerification: FormSessionPhoneVerificationActions;
    turnstile: FormSessionTurnstileActions;
    /** Resolves a label, placeholder or checkbox text in the session's language and copy. */
    message(value: string | null | undefined): string;
    /** The `marketing_consent` box text naming `companyName`, or undefined when it must stay hidden. */
    marketingConsentText(): string | undefined;
    /** Aborts requests in flight and removes a mounted Turnstile widget; the session stays usable. */
    dispose(): void;
}

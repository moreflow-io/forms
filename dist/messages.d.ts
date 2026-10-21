/**
 * Default de/en copy for the `forms.*` message keys that Moreflow persists in
 * published form definitions (labels, placeholders, privacy texts, button
 * texts). Generated from the Moreflow message catalogs — do not edit values by
 * hand; regenerate them from `messages/de.json` and `messages/en.json`.
 */
export type FormMessageLanguage = 'de' | 'en';
export declare const FORM_MESSAGE_LANGUAGES: readonly FormMessageLanguage[];
/**
 * Default form copy keyed by normalized message id (see {@link formMessageId}).
 * `public_marketing_consent_label` is not a persisted `forms.*` key; render it
 * with {@link marketingConsentText}.
 */
export declare const formMessageCatalogs: Readonly<Record<FormMessageLanguage, Readonly<Record<string, string>>>>;
/** Whether a persisted label/placeholder value is a Moreflow message key rather than literal text. */
export declare function isFormMessageKey(value: string | null | undefined): boolean;
/**
 * Normalizes a persisted dotted key (`forms.privacy.iAgree`) to the catalog's
 * message id (`forms_privacy_i_agree`), the same way Moreflow's own renderer
 * resolves it.
 */
export declare function formMessageId(key: string): string;
/** How German copy addresses the visitor: `'formal'` ("Sie", the default) or `'informal'` ("du"). */
export type FormFormality = 'formal' | 'informal';
/**
 * Your own copy, replacing the package defaults for the language you render
 * in. Every text helper and `createFormSession` read the same map.
 */
export interface FormMessageOverrides {
    /**
     * Text for persisted `forms.*` message keys, keyed by the dotted key
     * (`forms.settings.submitButton`) or its message id
     * (`forms_settings_submit_button`).
     */
    forms?: Readonly<Record<string, string>> | undefined;
    /** Text per validation code, e.g. `{ CONSENT_REQUIRED: 'Bitte stimme zu.' }`. */
    validation?: Readonly<Partial<Record<string, string>>> | undefined;
    /** Text per error code (`FormErrorCode`), e.g. `{ FORM_NOT_FOUND: '...' }`. */
    errors?: Readonly<Partial<Record<string, string>>> | undefined;
}
/** The options every localized text helper accepts. */
export interface FormCopyOptions {
    /** Defaults to `'de'`; pass the language you render the form in. */
    language?: FormMessageLanguage | undefined;
    /** German only; defaults to `'formal'` ("Sie"). */
    formality?: FormFormality | undefined;
    messages?: FormMessageOverrides | undefined;
}
export interface ResolveFormMessageOptions {
    /** Target language; defaults to `'de'` (Moreflow's primary form language). */
    language?: FormMessageLanguage | undefined;
    /** Values for `{placeholder}` tokens, e.g. `{ companyName: 'ACME GmbH' }`. */
    params?: Record<string, string | number> | undefined;
    /** `messages.forms` replaces the default copy for a key. */
    messages?: FormMessageOverrides | undefined;
}
/**
 * Resolves a persisted label/placeholder value: message keys become your
 * `messages.forms` text or the default copy for the requested language
 * (falling back to the other language before giving up), literal text passes
 * through unchanged. Safe to call on every label a form definition provides.
 */
export declare function resolveFormMessage(value: string | null | undefined, options?: ResolveFormMessageOptions): string;
export interface MarketingConsentTextOptions {
    /**
     * The company name your page shows: the tenant brand's display name (the
     * company profile name in Moreflow), exactly as Moreflow's hosted form
     * shows it, because Moreflow rebuilds this text from that name to evidence
     * the consent.
     */
    companyName: string | null | undefined;
    /** Defaults to `'de'`; submit the same value as `input.locale`. */
    language?: FormMessageLanguage | undefined;
}
/**
 * The text of an optional `marketing_consent` checkbox: Moreflow's marketing
 * consent wording naming the company, in the visitor's language. Returns
 * `undefined` without a non-blank company name; the box must then stay hidden
 * (see `isComponentVisibleToVisitors`). Render the box unticked and send the
 * same `language` as `input.locale`, so the consent evidence Moreflow records
 * hashes the exact text the visitor saw.
 */
export declare function marketingConsentText(options: MarketingConsentTextOptions): string | undefined;

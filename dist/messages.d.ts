/**
 * Default de/en copy for the `forms.*` message keys that Moreflow persists in
 * published form definitions (labels, placeholders, privacy texts, button
 * texts). Generated from the Moreflow message catalogs — do not edit values by
 * hand; regenerate them from `messages/de.json` and `messages/en.json`.
 */
export type FormMessageLanguage = 'de' | 'en';
export declare const FORM_MESSAGE_LANGUAGES: readonly FormMessageLanguage[];
/** Default form copy keyed by normalized message id (see {@link formMessageId}). */
export declare const formMessageCatalogs: Readonly<Record<FormMessageLanguage, Readonly<Record<string, string>>>>;
/** Whether a persisted label/placeholder value is a Moreflow message key rather than literal text. */
export declare function isFormMessageKey(value: string | null | undefined): boolean;
/**
 * Normalizes a persisted dotted key (`forms.privacy.iAgree`) to the catalog's
 * message id (`forms_privacy_i_agree`), the same way Moreflow's own renderer
 * resolves it.
 */
export declare function formMessageId(key: string): string;
export interface ResolveFormMessageOptions {
    /** Target language; defaults to `'de'` (Moreflow's primary form language). */
    language?: FormMessageLanguage | undefined;
    /** Values for `{placeholder}` tokens, e.g. `{ companyName: 'ACME GmbH' }`. */
    params?: Record<string, string | number> | undefined;
}
/**
 * Resolves a persisted label/placeholder value: message keys become the
 * default copy for the requested language (falling back to the other language
 * before giving up), literal text passes through unchanged. Safe to call on
 * every label a form definition provides.
 */
export declare function resolveFormMessage(value: string | null | undefined, options?: ResolveFormMessageOptions): string;

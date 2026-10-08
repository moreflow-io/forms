import { type JsonObject } from './json';
export interface PublicFormOption {
    id?: string | undefined;
    value: string;
    label: string;
}
export interface PublicFormComponent {
    id: string;
    /** Component type, e.g. `text`, `email`, `phone_number`, `dropdown`, `privacy_policy`, `heading`. */
    type: string;
    /** Label text or a `forms.*` message key — resolve with `resolveFormMessage`. */
    label?: string | undefined;
    /** Placeholder text or a `forms.*` message key. */
    placeholder?: string | undefined;
    /** Merged from the persisted `required`/`isRequired` duality. */
    required: boolean;
    showLabel?: boolean | undefined;
    showPlaceholder?: boolean | undefined;
    /** Normalized to objects; persisted string options become `{ value, label }`. */
    options?: PublicFormOption[] | undefined;
    /** Privacy checkbox text or a `forms.privacy.*` message key. */
    checkboxText?: string | undefined;
    /** Phone fields only: the embed must run phone verification before submitting. */
    verifyPhone?: boolean | undefined;
    importAs?: string | undefined;
    size?: string | undefined;
    /** The persisted component including every passthrough property. */
    raw: JsonObject;
}
export interface PublicFormThankYouItem {
    id: string;
    /** Content item type, e.g. `heading`, `text`, `image`. */
    type: string;
    props?: JsonObject | undefined;
    raw: JsonObject;
}
interface PublicFormPageBase {
    id: string;
    title?: string | undefined;
    description?: string | undefined;
    order?: number | undefined;
    raw: JsonObject;
}
export interface PublicFormRegularPage extends PublicFormPageBase {
    type: 'regular';
    components: PublicFormComponent[];
}
export interface PublicFormThankYouPage extends PublicFormPageBase {
    type: 'thank_you';
    content: PublicFormThankYouItem[];
}
export type PublicFormPage = PublicFormRegularPage | PublicFormThankYouPage;
export interface PublicFormFieldMatch {
    formFieldId: string;
    clientField: string;
}
export interface PublicFormTurnstileProtection {
    /** A public site key. The server-side secret is never part of a definition. */
    siteKey: string;
    mode: 'off' | 'flag' | 'require';
}
export interface PublicFormSpamProtection {
    turnstile: PublicFormTurnstileProtection;
}
/**
 * Standalone SDK projection of Moreflow's canonical AccountId brand.
 * Keep its structure compatible with types/domain/ids.ts without importing
 * private monorepo source into the published package.
 */
export type PublicFormAccountId = string & {
    readonly __tableName: 'accounts';
    readonly __domainId?: 'AccountId' | undefined;
};
export interface PublicFormDefinition {
    formId: string;
    accountId?: PublicFormAccountId | undefined;
    name?: string | undefined;
    /** Render an off-screen text input with this name and submit its value as `input.spam.honeypot`. */
    honeypotField: string;
    /** Discovery configuration for optional Turnstile mounting in a custom embed. */
    spamProtection: PublicFormSpamProtection;
    versionId?: string | undefined;
    versionNumber?: number | undefined;
    publishedAt?: string | undefined;
    settings: JsonObject;
    pages: PublicFormPage[];
    /** Pass unchanged as `input.fieldMatching` to `submitWithRetry`. */
    fieldMatching: PublicFormFieldMatch[];
}
/** Component types that render content and never collect input. */
export declare const PRESENTATIONAL_COMPONENT_TYPES: ReadonlySet<string>;
export declare const PHONE_COMPONENT_TYPES: ReadonlySet<string>;
export declare const CONSENT_COMPONENT_TYPES: ReadonlySet<string>;
/**
 * Normalizes any shape the public form endpoint has historically returned into
 * one canonical {@link PublicFormDefinition}: the top-level `version`, the
 * legacy copy under `record.data.config.current_version`, snake_case
 * `field_matching`, string options, and the `required`/`isRequired` duality.
 * Prefers the candidate whose thank-you page still carries its content props.
 */
export declare function normalizePublicFormDefinition(body: unknown, options?: {
    formId?: string | undefined;
}): PublicFormDefinition;
export interface GetPublicFormOptions {
    formId: string;
    /** Defaults to `''`, i.e. the page's own origin behind a same-origin proxy. */
    baseUrl?: string | undefined;
    /** Sends `Authorization: Bearer <token>` with the request. */
    token?: string | undefined;
    headers?: Record<string, string> | undefined;
    fetchImpl?: typeof fetch | undefined;
    signal?: AbortSignal | undefined;
}
/**
 * Loads the published definition of a public form
 * (`GET /api/v1/forms/{formId}`) and returns it as one canonical
 * {@link PublicFormDefinition}, so embeds never have to probe response shapes.
 * Failures throw {@link MoreflowFormError} with the server's navigational code
 * (`FORM_NOT_FOUND`, `FORM_RETIRED`, `FORM_UNPUBLISHED`, ...).
 */
export declare function getPublicForm(options: GetPublicFormOptions): Promise<PublicFormDefinition>;
export interface PartitionedFormPages {
    /** Regular wizard pages in order. */
    steps: PublicFormRegularPage[];
    /** The thank-you page, when the form defines one. */
    thankYou: PublicFormThankYouPage | undefined;
}
export declare function partitionFormPages(definition: PublicFormDefinition): PartitionedFormPages;
/** All input-collecting components across the form's regular pages. */
export declare function formInputComponents(definition: PublicFormDefinition): PublicFormComponent[];
/**
 * Phone components that require SMS verification before submission. When this
 * is non-empty, run `sendPhoneVerification`/`checkPhoneVerification` for the
 * entered number and submit the verified E.164 value — the submission endpoint
 * does not enforce verification for you.
 */
export declare function phoneVerificationComponents(definition: PublicFormDefinition): PublicFormComponent[];
export declare function phoneVerificationRequired(definition: PublicFormDefinition): boolean;
export {};
